from pydantic import BaseModel, Field

class ChatRequest(BaseModel):
    question: str = Field(min_length=2, max_length=4000)
    language: str = Field(default="auto", max_length=20)
    top_k: int | None = Field(default=None, ge=1, le=10)

class Source(BaseModel):
    title: str
    content: str
    page: int
    section: str | None = None
    score: float | None = None
    document_id: str | None = None

class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]
    grounded: bool
    message: str | None = None
