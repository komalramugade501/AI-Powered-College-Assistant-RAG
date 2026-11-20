
import json
import math
import re
import time
import urllib.request
import urllib.error
from functools import lru_cache

import chromadb

from app.core.config import settings


# Separate collection preserves old Sentence Transformer vectors.
COLLECTION = "college_documents_gemini"

EMBEDDING_MODEL = "models/gemini-embedding-001"
EMBEDDING_DIMENSION = 768
EMBEDDING_BATCH_SIZE = 16

# Keep below the Gemini free-tier limit of 100 embedding requests/minute.
# Each batch contains up to 16 individual embedding requests.
BATCH_DELAY_SECONDS = 12

MAX_RETRIES = 6
MAX_RETRY_DELAY_SECONDS = 60


@lru_cache(maxsize=1)
def get_client():
    path = settings.root_data / "chroma_db"
    path.mkdir(parents=True, exist_ok=True)

    return chromadb.PersistentClient(path=str(path))


def get_collection():
    return get_client().get_or_create_collection(
        name=COLLECTION,
        metadata={"hnsw:space": "cosine"}
    )


def normalize_vector(vector):
    norm = math.sqrt(sum(value * value for value in vector))

    if not norm:
        raise RuntimeError("Gemini returned a zero-length embedding.")

    return [value / norm for value in vector]


def get_retry_delay(details: str, attempt: int) -> float:
    """Read Gemini's suggested retry delay, with exponential backoff."""

    match = re.search(
        r'"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"',
        details
    )

    if match:
        delay = float(match.group(1))
    else:
        delay = 2 ** attempt

    return min(max(delay, 5), MAX_RETRY_DELAY_SECONDS)


def embed_batch(requests: list[dict]) -> list[dict]:
    """Send one embedding batch and retry temporary quota errors."""

    payload = {"requests": requests}

    request = urllib.request.Request(
        (
            "https://generativelanguage.googleapis.com/v1beta/"
            "models/gemini-embedding-001:batchEmbedContents"
        ),
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": settings.llm_api_key
        },
        method="POST"
    )

    for attempt in range(MAX_RETRIES):

        try:
            with urllib.request.urlopen(
                request,
                timeout=60
            ) as response:

                data = json.loads(
                    response.read().decode("utf-8")
                )

                return data.get("embeddings", [])

        except urllib.error.HTTPError as exc:

            details = exc.read().decode(
                "utf-8",
                errors="replace"
            )

            if exc.code == 429 and attempt < MAX_RETRIES - 1:

                delay = get_retry_delay(details, attempt)

                print(
                    f"Gemini quota limit reached. "
                    f"Retrying in {delay:.1f} seconds "
                    f"(attempt {attempt + 1}/{MAX_RETRIES - 1})."
                )

                time.sleep(delay)
                continue

            raise RuntimeError(
                f"Gemini Embeddings HTTP {exc.code}: {details}"
            ) from exc

        except urllib.error.URLError as exc:

            raise RuntimeError(
                f"Gemini Embeddings connection failed: {exc.reason}"
            ) from exc

    raise RuntimeError("Gemini embedding retries exhausted.")


def embed_texts(
    texts: list[str],
    task_type: str,
    title: str = ""
):
    if not settings.llm_api_key:
        raise RuntimeError("Gemini API key is not configured.")

    if not texts:
        return []

    all_vectors = []

    total_batches = math.ceil(
        len(texts) / EMBEDDING_BATCH_SIZE
    )

    for batch_number, start in enumerate(
        range(0, len(texts), EMBEDDING_BATCH_SIZE),
        start=1
    ):

        batch = texts[start:start + EMBEDDING_BATCH_SIZE]
        requests = []

        for text in batch:

            item = {
                "model": EMBEDDING_MODEL,
                "content": {
                    "parts": [{"text": text}]
                },
                "taskType": task_type,
                "outputDimensionality": EMBEDDING_DIMENSION
            }

            if title and task_type == "RETRIEVAL_DOCUMENT":
                item["title"] = title

            requests.append(item)

        embeddings = embed_batch(requests)

        if len(embeddings) != len(batch):
            raise RuntimeError(
                "Gemini returned an unexpected embedding count."
            )

        for embedding in embeddings:

            values = embedding.get("values", [])

            if len(values) != EMBEDDING_DIMENSION:
                raise RuntimeError(
                    "Gemini returned an invalid embedding dimension. "
                    f"Expected {EMBEDDING_DIMENSION}, "
                    f"received {len(values)}."
                )

            all_vectors.append(normalize_vector(values))

        print(
            f"Embedding batch {batch_number}/{total_batches} completed."
        )

        # Pace requests to stay below the free-tier quota.
        if batch_number < total_batches:
            time.sleep(BATCH_DELAY_SECONDS)

    return all_vectors


def add_chunks(chunks: list[dict]):

    if not chunks:
        return

    collection = get_collection()

    for start in range(0, len(chunks), EMBEDDING_BATCH_SIZE):

        batch = chunks[start:start + EMBEDDING_BATCH_SIZE]

        texts = [
            item["text"]
            for item in batch
        ]

        title = batch[0]["metadata"].get("title", "")

        vectors = embed_texts(
            texts,
            task_type="RETRIEVAL_DOCUMENT",
            title=title
        )

        collection.upsert(
            ids=[
                item["id"]
                for item in batch
            ],
            documents=texts,
            metadatas=[
                item["metadata"]
                for item in batch
            ],
            embeddings=vectors
        )


def query_chunks(
    question: str,
    top_k: int = 5
) -> list[dict]:

    collection = get_collection()

    count = collection.count()

    if count == 0:
        return []

    vector = embed_texts(
        [question],
        task_type="RETRIEVAL_QUERY"
    )[0]

    result = collection.query(
        query_embeddings=[vector],
        n_results=min(top_k * 3, count)
    )

    rows = []

    ids = (result.get("ids") or [[]])[0]
    docs = (result.get("documents") or [[]])[0]
    metas = (result.get("metadatas") or [[]])[0]
    distances = (result.get("distances") or [[]])[0]

    for i, text in enumerate(docs):

        distance = (
            float(distances[i])
            if i < len(distances)
            else 1.0
        )

        rows.append({
            "id": ids[i],
            "text": text,
            "metadata": metas[i] or {},
            "vector_score": max(0.0, 1.0 - distance)
        })

    return rows


def delete_document_chunks(document_id: str):

    get_collection().delete(
        where={"document_id": document_id}
    )


def collection_count() -> int:

    return get_collection().count()
