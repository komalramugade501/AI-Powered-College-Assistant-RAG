
import hashlib
import json
import uuid
from pathlib import Path

from app.core.config import settings
from app.services.pdf_service import extract_text_from_pdf
from app.services.chunking import chunk_pages
from app.services.vector_store import (
    add_chunks,
    delete_document_chunks,
    get_collection,
)


def calculate_sha256(file_path: Path) -> str:
    """Calculate file hash without loading the entire PDF into RAM."""
    digest = hashlib.sha256()

    with file_path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)

    return digest.hexdigest()


def index_pdf(temp_path: Path, original_name: str) -> dict:
    digest = calculate_sha256(temp_path)

    docs_dir = settings.root_data / "documents"
    docs_dir.mkdir(parents=True, exist_ok=True)

    manifest_path = settings.root_data / "documents.json"

    records = (
        json.loads(manifest_path.read_text("utf-8"))
        if manifest_path.exists()
        else []
    )

    duplicate = next(
        (document for document in records if document["sha256"] == digest),
        None,
    )

    if duplicate:
        # Check whether all expected embeddings exist.
        existing = get_collection().get(
            where={"document_id": duplicate["id"]},
            include=[],
        )

        existing_ids = existing.get("ids") or []
        expected_chunks = int(duplicate.get("chunks", 0))

        if expected_chunks > 0 and len(existing_ids) == expected_chunks:
            return {
                **duplicate,
                "duplicate": True,
                "chunks_added": 0,
            }

        # Remove incomplete embeddings before retrying indexing.
        if existing_ids:
            delete_document_chunks(duplicate["id"])

        # Re-index the existing document using Gemini embeddings.
        document_id = duplicate["id"]
        safe_name = duplicate["stored_name"]
        destination = docs_dir / safe_name

        if not destination.exists():
            temp_path.replace(destination)
        else:
            temp_path.unlink(missing_ok=True)

        is_existing_record = True

    else:
        document_id = uuid.uuid4().hex
        safe_name = f"{document_id}.pdf"
        destination = docs_dir / safe_name

        temp_path.replace(destination)
        is_existing_record = False

    try:
        pages = extract_text_from_pdf(destination)

        chunks = chunk_pages(
            pages,
            original_name,
            document_id,
        )

        add_chunks(chunks)

    except Exception:
        if not is_existing_record:
            destination.unlink(missing_ok=True)
        raise

    record = {
        "id": document_id,
        "title": original_name,
        "stored_name": safe_name,
        "sha256": digest,
        "pages_with_text": len(pages),
        "chunks": len(chunks),
    }

    if not is_existing_record:
        records.append(record)
    else:
        records = [
            record if item["id"] == document_id else item
            for item in records
        ]

    manifest_path.write_text(
        json.dumps(records, indent=2),
        encoding="utf-8",
    )

    return {
        **record,
        "duplicate": False,
        "chunks_added": len(chunks),
    }


def list_documents() -> list[dict]:
    manifest_path = settings.root_data / "documents.json"

    if not manifest_path.exists():
        return []

    return json.loads(manifest_path.read_text("utf-8"))


def remove_document(document_id: str) -> bool:
    records = list_documents()

    match = next(
        (document for document in records if document["id"] == document_id),
        None,
    )

    if not match:
        return False

    delete_document_chunks(document_id)

    (
        settings.root_data / "documents" / match["stored_name"]
    ).unlink(missing_ok=True)

    records = [
        document
        for document in records
        if document["id"] != document_id
    ]

    (
        settings.root_data / "documents.json"
    ).write_text(
        json.dumps(records, indent=2),
        encoding="utf-8",
    )

    return True
