
from fastapi import APIRouter, HTTPException

from app.schemas.chat import ChatRequest, ChatResponse, Source
from app.services.retrieval import hybrid_search
from app.services.llm_service import generate_answer
from app.core.config import settings


router = APIRouter(prefix="/chat", tags=["Chat"])

# Initial threshold calibrated against the current syllabus tests.
MIN_RELEVANCE_SCORE = max(settings.min_relevance_score, 0.40)


@router.post("", response_model=ChatResponse)
def chat(payload: ChatRequest):

    question = payload.question.strip()

    if not question:
        raise HTTPException(
            status_code=422,
            detail="Question cannot be empty."
        )

    results = hybrid_search(question, payload.top_k)

    # Abstain when no sufficiently relevant passage is found.
    if (
        not results
        or results[0]["score"] < MIN_RELEVANCE_SCORE
    ):
        return ChatResponse(
            answer=(
                "I couldn't find reliable information about this "
                "question in the currently uploaded college documents. "
                "Please upload the relevant official document or "
                "contact your college office."
            ),
            sources=[],
            grounded=False,
            message=(
                "Insufficient supporting evidence in the indexed documents."
            )
        )

    answer = generate_answer(
        question,
        results,
        payload.language
    )

    sources = [
        Source(
            title=str(
                item["metadata"].get("title", "College document")
            ),
            content=item["text"],
            page=int(item["metadata"].get("page", 1)),
            score=round(float(item["score"]), 4),
            document_id=str(
                item["metadata"].get("document_id", "")
            )
        )
        for item in results
    ]

    return ChatResponse(
        answer=answer,
        sources=sources,
        grounded=True
    )
