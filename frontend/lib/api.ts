
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8001";

// -------------------- CHAT TYPES --------------------

export type ChatSource = {
  title: string;
  content: string;
  page: number;
  section?: string | null;
  score: number | null;
  document_id: string | null;
  url?: string;
};

export type ChatResponse = {
  answer: string;
  sources: ChatSource[];
  grounded: boolean;
  message: string | null;
};

export type ChatLanguage = "auto" | "English" | "Hindi" | "Marathi";

// -------------------- DOCUMENT TYPES --------------------

export type DocumentRecord = {
  id: string;
  title: string;
  stored_name: string;
  sha256: string;
  pages_with_text: number;
  chunks: number;
};

export type DocumentsResponse = {
  documents: DocumentRecord[];
  total: number;
  indexed_chunks: number;
};

export type UploadResponse = DocumentRecord & {
  message: string;
  duplicate: boolean;
  chunks_added: number;
};

export type DeleteResponse = {
  message: string;
  document_id: string;
};

// -------------------- COMMON API HELPER --------------------

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `API request failed (${response.status}).`;

    try {
      const errorData = await response.json();

      if (typeof errorData.detail === "string") {
        errorMessage = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        errorMessage = errorData.detail
          .map((item: { msg?: string }) => item.msg || "Invalid request")
          .join(", ");
      }
    } catch {
      // Keep the default error message.
    }

    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

// -------------------- CHAT API --------------------

export async function askThinkHub(
  question: string,
  language: ChatLanguage = "auto",
  top_k: number = 5
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question,
      language,
      top_k,
    }),
  });

  return handleResponse<ChatResponse>(response);
}

// -------------------- DOCUMENT LIST API --------------------

export async function getDocuments(): Promise<DocumentsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/documents`, {
    method: "GET",
    cache: "no-store",
  });

  return handleResponse<DocumentsResponse>(response);
}

// -------------------- PDF UPLOAD API --------------------

export async function uploadDocument(
  file: File
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
    method: "POST",
    body: formData,
  });

  return handleResponse<UploadResponse>(response);
}

// -------------------- DOCUMENT DELETE API --------------------

export async function deleteDocument(
  documentId: string
): Promise<DeleteResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/documents/${encodeURIComponent(documentId)}`,
    {
      method: "DELETE",
    }
  );

  return handleResponse<DeleteResponse>(response);
}
