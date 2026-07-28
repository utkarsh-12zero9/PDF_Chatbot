const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ChunkInfo {
  chunk_id: number;
  page: number;
  character_count: number;
  content: string;
}

export interface PdfUploadResult {
  pdf_id: string;
  filename: string;
  file_path: string;
  total_pages: number;
  total_characters: number;
  total_chunks: number;
  chunk_size: number;
  chunk_overlap: number;
  vector_db: string;
  indexed_vectors: number;
  preview_text: string;
  chunks: ChunkInfo[];
  pages: Array<{
    page_number: number;
    character_count: number;
    content: string;
  }>;
}

export async function sendChatMessageStream(
  message: string,
  pdfId: string | null | undefined,
  onChunk: (chunk: string) => void
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      pdf_id: pdfId || null
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Failed to send message (${response.status}): ${errorText}`);
  }

  if (!response.body) {
    throw new Error("Response body is missing");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    onChunk(chunk);
  }
}

export async function uploadPdfFile(file: File): Promise<PdfUploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => null);
    const message = errorJson?.detail || `Upload failed with status ${response.status}`;
    throw new Error(message);
  }

  const json = await response.json();
  return json.data;
}
