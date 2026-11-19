from functools import lru_cache
from pathlib import Path
import chromadb
from sentence_transformers import SentenceTransformer
from app.core.config import settings

COLLECTION = "thinkhub_documents"

@lru_cache(maxsize=1)
def get_embedder():
    # First startup downloads the multilingual model if it is not cached.
    return SentenceTransformer(settings.embedding_model)

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

def add_chunks(chunks: list[dict]):
    if not chunks:
        return
    model = get_embedder()
    texts = [c["text"] for c in chunks]
    vectors = model.encode(texts, normalize_embeddings=True).tolist()
    collection = get_collection()
    collection.upsert(
        ids=[c["id"] for c in chunks],
        documents=texts,
        metadatas=[c["metadata"] for c in chunks],
        embeddings=vectors
    )

def query_chunks(question: str, top_k: int = 5) -> list[dict]:
    collection = get_collection()
    if collection.count() == 0:
        return []
    vector = get_embedder().encode([question], normalize_embeddings=True).tolist()
    result = collection.query(query_embeddings=vector, n_results=min(top_k * 3, collection.count()))
    rows = []
    ids = (result.get("ids") or [[]])[0]
    docs = (result.get("documents") or [[]])[0]
    metas = (result.get("metadatas") or [[]])[0]
    distances = (result.get("distances") or [[]])[0]
    for i, text in enumerate(docs):
        distance = float(distances[i]) if i < len(distances) else 1.0
        rows.append({"id": ids[i], "text": text, "metadata": metas[i] or {}, "vector_score": max(0.0, 1.0-distance)})
    return rows

def delete_document_chunks(document_id: str):
    get_collection().delete(where={"document_id": document_id})

def collection_count() -> int:
    return get_collection().count()
