
import re

from rank_bm25 import BM25Okapi

from app.core.config import settings
from app.services.vector_store import get_collection, query_chunks


STOPWORDS = {
    "what", "which", "where", "when", "who", "why", "how",
    "is", "are", "was", "were", "the", "a", "an",
    "in", "on", "at", "of", "for", "to", "and", "or",
    "with", "by", "from", "included", "include", "includes",
    "does", "do", "can", "could", "would", "should"
}

SEMESTER_PATTERNS = {
    1: r"\b(first semester|1st semester|semester i)\b",
    2: r"\b(second semester|2nd semester|semester ii)\b",
    3: r"\b(third semester|3rd semester|semester iii)\b",
    4: r"\b(fourth semester|4th semester|semester iv)\b",
    5: r"\b(fifth semester|5th semester|semester v)\b",
    6: r"\b(sixth semester|6th semester|semester vi)\b",
    7: r"\b(seventh semester|7th semester|semester vii)\b",
    8: r"\b(eighth semester|8th semester|semester viii)\b",
}


def tokenize(text: str) -> list[str]:
    words = re.findall(r"\b[a-zA-Z0-9]+\b", text.lower())
    return [word for word in words if word not in STOPWORDS]


def detect_semester(text: str) -> int | None:
    normalized = " ".join(text.lower().split())

    for semester, pattern in SEMESTER_PATTERNS.items():
        if re.search(pattern, normalized):
            return semester

    return None


def hybrid_search(
    question: str,
    top_k: int | None = None
) -> list[dict]:

    k = top_k or settings.top_k

    if not question.strip():
        return []

    query_tokens = tokenize(question)

    if not query_tokens:
        return []

    # 1. Semantic retrieval
    vector_results = query_chunks(question, max(k * 3, 15))

    semantic_results = {
        item["id"]: item for item in vector_results
    }

    # 2. Load indexed chunks
    collection = get_collection()

    stored = collection.get(
        include=["documents", "metadatas"]
    )

    ids = stored.get("ids") or []
    documents = stored.get("documents") or []
    metadatas = stored.get("metadatas") or []

    if not documents:
        return []

    # 3. BM25 keyword retrieval
    corpus = [
        tokenize(document or "") or ["__empty__"]
        for document in documents
    ]

    bm25 = BM25Okapi(corpus)
    raw_scores = bm25.get_scores(query_tokens)

    max_bm25 = max(raw_scores) if len(raw_scores) else 0.0

    # 4. Identify requested semester
    requested_semester = detect_semester(question)

    # 5. Determine whether the question asks for a course list
    question_lower = question.lower()

    asks_for_courses = any(
        term in question_lower
        for term in [
            "subjects", "courses", "course list",
            "included in", "curriculum"
        ]
    )

    results = []

    for i, doc_id in enumerate(ids):

        text = documents[i] or ""
        normalized_text = " ".join(text.lower().split())

        # Semantic score
        semantic_item = semantic_results.get(doc_id)

        semantic_score = (
            float(semantic_item.get("vector_score", 0.0))
            if semantic_item else 0.0
        )

        # Normalized BM25 score
        bm25_score = (
            float(raw_scores[i] / max_bm25)
            if max_bm25 > 0 else 0.0
        )

        # Meaningful phrase matching
        normalized_tokens = tokenize(text)

        query_phrases = [
            " ".join(query_tokens[j:j + 2])
            for j in range(len(query_tokens) - 1)
        ]

        phrase_matches = sum(
            1 for phrase in query_phrases
            if phrase in " ".join(normalized_tokens)
        )

        phrase_score = (
            phrase_matches / len(query_phrases)
            if query_phrases else 0.0
        )

        # Semester-intent matching
        document_semester = detect_semester(text)

        semester_score = 0.0

        if requested_semester is not None:
            if document_semester == requested_semester:
                semester_score = 1.0

        # Course-table structure detection
        table_indicators = [
            "course category",
            "course code",
            "course name",
            "weekly hours",
            "examination scheme"
        ]

        matched_indicators = sum(
            1 for indicator in table_indicators
            if indicator in normalized_text
        )

        table_score = min(matched_indicators / 3, 1.0)

        # 6. Context-aware hybrid score
        final_score = (
            0.60 * semantic_score
            + 0.15 * bm25_score
            + 0.10 * phrase_score
            + 0.10 * semester_score
            + (
                0.05 * table_score
                if asks_for_courses else 0.0
            )
        )

        results.append({
            "id": doc_id,
            "text": text,
            "metadata": metadatas[i] or {},
            "semantic_score": semantic_score,
            "vector_score": semantic_score,
            "bm25_score": bm25_score,
            "phrase_score": phrase_score,
            "semester_score": semester_score,
            "table_score": table_score,
            "score": final_score
        })

    # 7. Sort by relevance
    results.sort(
        key=lambda item: item["score"],
        reverse=True
    )

    return results[:k]
