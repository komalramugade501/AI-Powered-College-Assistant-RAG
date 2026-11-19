
import json
import urllib.error
import urllib.request

from app.core.config import settings


def generate_answer(
    question: str,
    contexts: list[dict],
    language: str = "auto"
) -> str:

    joined = "\n\n".join(
        (
            f"[Source {i + 1}: "
            f"{c['metadata'].get('title', 'Document')}, "
            f"page {c['metadata'].get('page', '?')}]\n"
            f"{c['text']}"
        )
        for i, c in enumerate(contexts)
    )

    if settings.llm_api_key and settings.llm_model:

        system_instruction = (
            "You are ThinkHub, a careful college information assistant. "
            "Answer only using the supplied college-document context. "
            "If the context does not contain the answer, clearly state "
            "that the documents do not provide enough information. "
            "Do not invent dates, fees, rules, or policies. "
            "Cite source numbers using [Source 1] format. "
            "Respond in the user's preferred language when clear: "
            "English, Hindi, or Marathi."
        )

        user_prompt = (
            f"Preferred language: {language}\n\n"
            f"Question: {question}\n\n"
            f"College document context:\n{joined}"
        )

        url = (
            "https://generativelanguage.googleapis.com/v1beta/"
            f"models/{settings.llm_model}:generateContent"
        )

        payload = {
            "systemInstruction": {
                "parts": [
                    {"text": system_instruction}
                ]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": user_prompt}
                    ]
                }
            ],
            "generationConfig": {
                "maxOutputTokens": 2048
            }
        }

        request = urllib.request.Request(
            url=url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": settings.llm_api_key
            },
            method="POST"
        )

        try:
            with urllib.request.urlopen(
                request,
                timeout=60
            ) as response:

                response_data = json.loads(
                    response.read().decode("utf-8")
                )

            candidates = response_data.get("candidates", [])

            if not candidates:
                return (
                    "Gemini could not generate an answer "
                    "from the available documents."
                )

            parts = candidates[0].get("content", {}).get("parts", [])

            answer = "\n".join(
                part["text"]
                for part in parts
                if "text" in part
            ).strip()

            return answer or (
                "Gemini returned an empty response. "
                "Please try again."
            )

        except urllib.error.HTTPError as error:
            error_details = error.read().decode(
                "utf-8",
                errors="replace"
            )

            raise RuntimeError(
                f"Gemini API HTTP {error.code}: {error_details}"
            ) from error

        except urllib.error.URLError as error:
            raise RuntimeError(
                f"Could not connect to Gemini API: {error.reason}"
            ) from error

    # Safe no-key fallback: return retrieved evidence,
    # not a fabricated answer.

    excerpts = []

    for i, item in enumerate(contexts[:3], 1):
        title = item["metadata"].get(
            "title",
            "College document"
        )

        page = item["metadata"].get("page", "?")

        excerpts.append(
            f"{item['text']}\n\n"
            f"(Source {i}: {title}, page {page})"
        )

    if not excerpts:
        return (
            "No relevant college-document information "
            "is available to answer this question."
        )

    return (
        "I found these relevant passages in the uploaded "
        "college documents. Please review them to confirm "
        "the exact answer:\n\n"
        + "\n\n---\n\n".join(excerpts)
    )
