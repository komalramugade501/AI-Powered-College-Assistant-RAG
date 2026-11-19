import hashlib
import json
import uuid
from pathlib import Path
from app.core.config import settings
from app.services.pdf_service import extract_text_from_pdf
from app.services.chunking import chunk_pages
from app.services.vector_store import add_chunks, delete_document_chunks

def index_pdf(temp_path: Path, original_name: str) -> dict:
    digest = hashlib.sha256(temp_path.read_bytes()).hexdigest()
    docs_dir = settings.root_data / "documents"
    docs_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = settings.root_data / "documents.json"
    records = json.loads(manifest_path.read_text("utf-8")) if manifest_path.exists() else []
    duplicate = next((d for d in records if d["sha256"] == digest), None)
    if duplicate:
        return {**duplicate, "duplicate": True, "chunks_added": 0}
    document_id = uuid.uuid4().hex
    safe_name = f"{document_id}.pdf"
    destination = docs_dir / safe_name
    temp_path.replace(destination)
    try:
        pages = extract_text_from_pdf(destination)
        chunks = chunk_pages(pages, original_name, document_id)
        add_chunks(chunks)
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    record = {
        "id": document_id, "title": original_name, "stored_name": safe_name,
        "sha256": digest, "pages_with_text": len(pages), "chunks": len(chunks)
    }
    records.append(record)
    manifest_path.write_text(json.dumps(records, indent=2), encoding="utf-8")
    return {**record, "duplicate": False, "chunks_added": len(chunks)}

def list_documents() -> list[dict]:
    manifest_path = settings.root_data / "documents.json"
    return json.loads(manifest_path.read_text("utf-8")) if manifest_path.exists() else []

def remove_document(document_id: str) -> bool:
    records = list_documents()
    match = next((d for d in records if d["id"] == document_id), None)
    if not match:
        return False
    delete_document_chunks(document_id)
    (settings.root_data / "documents" / match["stored_name"]).unlink(missing_ok=True)
    records = [d for d in records if d["id"] != document_id]
    (settings.root_data / "documents.json").write_text(json.dumps(records, indent=2), encoding="utf-8")
    return True
