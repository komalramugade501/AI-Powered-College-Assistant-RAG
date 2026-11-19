# ThinkHub Backend

FastAPI backend for a college-document RAG assistant.

## Requirements
- Python 3.11 or 3.12 recommended (avoid Python 3.14 for this ML stack until all dependencies are verified).
- Windows PowerShell or macOS/Linux.
- Internet for the first multilingual embedding-model download.
- Optional OpenAI-compatible LLM API credentials for generative answers.

## Windows setup
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env` only if you have an LLM provider key. Leave LLM fields blank to use the evidence-excerpt fallback.

Start:
```powershell
python -m uvicorn app.main:app --reload --reload-dir app
```
Open http://127.0.0.1:8000/docs

## API
- `GET /health`
- `POST /api/documents/upload` (multipart field: `file`)
- `GET /api/documents`
- `DELETE /api/documents/{document_id}`
- `POST /api/chat` JSON: `{"question":"When are exams?","language":"en"}`

## RAG flow
PDF text extraction (PyMuPDF) -> page-preserving chunking -> multilingual Sentence Transformers embeddings -> persistent ChromaDB -> vector candidate retrieval + lexical reranking -> optional OpenAI-compatible LLM -> page-level source citations.

## Important limitations
- Scanned/image-only PDFs are detected and rejected with an OCR-required message; OCR is not included in this build.
- The first run downloads the embedding model. Network restrictions can prevent this.
- Generative LLM answers require a compatible provider key/model. Without it, ThinkHub returns retrieved evidence excerpts rather than fabricating a synthesized answer.
- The lightweight lexical reranker combines token overlap with vector similarity; it is not a full BM25 corpus-wide implementation.
- Authentication, role-based access control, cloud storage, audit logs, production rate limiting and deployment secrets must be configured before public institutional deployment.
- Do not upload confidential student records or sensitive personal data to an unapproved deployment.
