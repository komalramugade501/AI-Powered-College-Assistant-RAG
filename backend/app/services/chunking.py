from app.core.config import settings

def chunk_pages(pages: list[dict], title: str, document_id: str) -> list[dict]:
    size = settings.chunk_size
    overlap = min(settings.chunk_overlap, size // 2)
    chunks = []
    for page in pages:
        text = " ".join(page["content"].split())
        start = 0
        while start < len(text):
            end = min(start + size, len(text))
            piece = text[start:end].strip()
            if piece:
                chunks.append({
                    "id": f"{document_id}-p{page['page']}-c{len(chunks)+1}",
                    "text": piece,
                    "metadata": {"document_id": document_id, "title": title, "page": int(page["page"])}
                })
            if end >= len(text):
                break
            start = max(end - overlap, start + 1)
    return chunks
