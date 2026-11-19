from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.documents import router as documents_router
from app.api.chat import router as chat_router

app = FastAPI(
    title="ThinkHub API",
    description="Grounded multilingual college assistant using retrieval-augmented generation.",
    version="1.0.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(documents_router, prefix=settings.api_v1_prefix)
app.include_router(chat_router, prefix=settings.api_v1_prefix)

@app.get("/", tags=["System"])
def home():
    return {"application": "ThinkHub", "status": "running", "docs": "/docs"}

@app.get("/health", tags=["System"])
def health():
    return {"application": "ThinkHub", "status": "healthy"}
