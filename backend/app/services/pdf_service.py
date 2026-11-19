import fitz
from pathlib import Path

def extract_text_from_pdf(file_path: str | Path) -> list[dict]:
    pages = []
    with fitz.open(file_path) as pdf:
        if pdf.is_encrypted:
            raise ValueError("Password-protected PDFs are not supported.")
        for page_number, page in enumerate(pdf, start=1):
            text = page.get_text("text").strip()
            if text:
                pages.append({"page": page_number, "content": text})
    if not pages:
        raise ValueError("No selectable text was found. This may be a scanned PDF; OCR is not enabled yet.")
    return pages
