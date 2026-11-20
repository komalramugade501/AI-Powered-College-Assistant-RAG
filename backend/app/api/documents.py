
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, UploadFile, File, HTTPException

from app.core.config import settings
from app.services.document_service import (
    index_pdf,
    list_documents,
    remove_document,
)
from app.services.vector_store import collection_count


router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are accepted.",
        )

    temp_dir = settings.root_data / "tmp"
    temp_dir.mkdir(parents=True, exist_ok=True)

    temp_path = None
    total_size = 0
    first_bytes = b""

    try:
        with NamedTemporaryFile(
            delete=False,
            suffix=".pdf",
            dir=temp_dir,
        ) as tmp:

            temp_path = Path(tmp.name)

            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                if not first_bytes:
                    first_bytes = chunk[:4]

                total_size += len(chunk)

                if total_size > settings.max_upload_mb * 1024 * 1024:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds {settings.max_upload_mb} MB limit.",
                    )

                tmp.write(chunk)

        if total_size == 0:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty.",
            )

        if not first_bytes.startswith(b"%PDF"):
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is not a valid PDF.",
            )

        result = index_pdf(
            temp_path,
            Path(file.filename).name,
        )

        return {
            "message": (
                "Document processed successfully."
                if not result["duplicate"]
                else "This document is already indexed."
            ),
            **result,
        }

    except HTTPException:
        raise

    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Document processing failed: {type(exc).__name__}",
        ) from exc

    finally:
        if temp_path:
            temp_path.unlink(missing_ok=True)

        await file.close()


@router.get("")
def documents():
    records = list_documents()

    return {
        "documents": records,
        "total": len(records),
        "indexed_chunks": collection_count(),
    }


@router.delete("/{document_id}")
def delete_document(document_id: str):

    if not remove_document(document_id):
        raise HTTPException(
            status_code=404,
            detail="Document not found.",
        )

    return {
        "message": "Document deleted.",
        "document_id": document_id,
    }
