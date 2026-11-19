"use client";

import MarkdownContent from "@/components/MarkdownContent";

import { useEffect, useRef, useState } from "react";
import SiteHeader from "@/components/SiteHeader";

import {
  askThinkHub,
  getDocuments,
  uploadDocument,
  deleteDocument,
  type ChatSource,
  type ChatLanguage,
  type DocumentRecord,
} from "@/lib/api";

type Message = {
  role: "user" | "assistant";
  text: string;
  sources?: ChatSource[];
  grounded?: boolean;
  notice?: string | null;
};

const suggestions = [
  {
    icon: "📚",
    title: "Explore academics",
    text: "Help me understand my syllabus and academic requirements.",
  },
  {
    icon: "📅",
    title: "College updates",
    text: "How can I find important college notices and deadlines?",
  },
  {
    icon: "🎯",
    title: "Plan my career",
    text: "Help me create a career preparation plan for my degree.",
  },
  {
    icon: "✍️",
    title: "Study smarter",
    text: "How can I prepare effectively for my next examination?",
  },
];

function SourceList({ sources }: { sources: ChatSource[] }) {
  if (!sources.length) return null;

  return (
    <div className="mt-4 border-t border-white/10 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-300">
        Supporting documents
      </p>

      <ul className="space-y-2">
        {sources.map((source, index) => (
          <li
            key={`${source.document_id ?? source.title}-${index}`}
            className="rounded-lg border border-white/[0.08] bg-black/10 p-3 text-xs"
          >
            <p className="font-medium text-slate-200">
              {source.title || `Source ${index + 1}`}
              {source.page !== undefined && (
                <span className="ml-2 text-slate-400">
                  · Page {source.page}
                </span>
              )}
            </p>

            {source.section && (
              <p className="mt-1 text-slate-500">{source.section}</p>
            )}

            {source.content && (
              <p className="mt-2 leading-5 text-slate-400">
                {source.content}
              </p>
            )}

            {typeof source.score === "number" && (
              <p className="mt-2 text-[10px] text-slate-500">
                Relevance score: {source.score.toFixed(3)}
              </p>
            )}

            {source.url && /^https?:\/\//i.test(source.url) && (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-blue-300 hover:text-blue-200"
              >
                Open source ↗
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Home() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [language, setLanguage] = useState<ChatLanguage>("auto");

  // Document management state
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [documentTotal, setDocumentTotal] = useState(0);
  const [indexedChunks, setIndexedChunks] = useState(0);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState("");
  const [documentStatus, setDocumentStatus] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing documents when the page opens.
  async function refreshDocuments() {
    setDocumentsLoading(true);
    setDocumentError("");

    try {
      const result = await getDocuments();

      setDocuments(result.documents);
      setDocumentTotal(result.total);
      setIndexedChunks(result.indexed_chunks);
    } catch (err) {
      setDocumentError(
        err instanceof Error
          ? err.message
          : "Could not load documents."
      );
    } finally {
      setDocumentsLoading(false);
    }
  }

  useEffect(() => {
    void refreshDocuments();
  }, []);

  // Chat functionality
  async function sendMessage(value = question) {
    const text = value.trim();

    if (!text || loading) return;

    setQuestion("");
    setError("");
    setLastQuestion(text);

    setMessages((previous) => [
      ...previous,
      { role: "user", text },
    ]);

    setLoading(true);

    try {
      const result = await askThinkHub(text, language, 5);

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text: result.answer,
          sources: result.sources,
          grounded: result.grounded,
          notice: result.message,
        },
      ]);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred.";

      setError(
        `${message} Please check whether the backend is running.`
      );
    } finally {
      setLoading(false);
    }
  }

  // PDF upload functionality
  async function handleUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setDocumentError("");
    setDocumentStatus("");

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setDocumentError("Only PDF files are accepted.");
      event.target.value = "";
      return;
    }

    setUploading(true);

    try {
      const result = await uploadDocument(file);

      setDocumentStatus(
        result.duplicate
          ? `"${result.title}" is already indexed. No duplicate chunks were added.`
          : `"${result.title}" uploaded successfully. ${result.chunks_added} chunks indexed.`
      );

      await refreshDocuments();
    } catch (err) {
      setDocumentError(
        err instanceof Error
          ? err.message
          : "PDF upload failed."
      );
    } finally {
      setUploading(false);

      // Allows selecting the same file again.
      event.target.value = "";
    }
  }

  // Delete one selected document.
  async function handleDelete(document: DocumentRecord) {
    const confirmed = window.confirm(
      `Delete "${document.title}"?\n\nThis will remove its stored PDF and its indexed chunks.`
    );

    if (!confirmed || deletingId) return;

    setDeletingId(document.id);
    setDocumentError("");
    setDocumentStatus("");

    try {
      const result = await deleteDocument(document.id);

      setDocumentStatus(result.message);
      await refreshDocuments();
    } catch (err) {
      setDocumentError(
        err instanceof Error
          ? err.message
          : "Could not delete the document."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#080b14] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/4 h-96 w-96 rounded-full bg-blue-600/15 blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-violet-600/10 blur-[120px]" />
      </div>

      <SiteHeader />

      {/* HERO SECTION */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-20 pt-24 md:px-12 md:pt-32">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/[0.07] px-4 py-2 text-xs tracking-widest text-blue-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            YOUR COLLEGE. ONE INTELLIGENT SPACE.
          </div>

          <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-0.055em] sm:text-6xl md:text-8xl">
            College life,
            <br />
            <span className="bg-gradient-to-r from-blue-300 via-indigo-300 to-violet-400 bg-clip-text text-transparent">
              made clearer.
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-slate-400 md:text-lg md:leading-8">
            Meet your AI-powered college companion. Find academic information,
            understand college documents, and get the clarity you need to move forward.
          </p>

          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href="#assistant"
              className="group rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-blue-100"
            >
              Explore AI_POWERED COLLEGE ASSISTANT USING RAG{" "}
              <span className="ml-2 inline-block transition group-hover:translate-x-1">
                →
              </span>
            </a>

            <a
              href="#how-it-works"
              className="rounded-full border border-white/15 px-7 py-3.5 text-sm transition hover:bg-white/[0.06]"
            >
              Discover how it works
            </a>
          </div>

          <div className="mt-14 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-xs text-slate-500">
            <span>✦ Built for your college community</span>
            <span>✦ Answers grounded in documents</span>
            <span>✦ Designed for students and faculty</span>
          </div>
        </div>

        {/* MAIN AI_POWERED COLLEGE ASSISTANT USING RAG WORKSPACE */}
        <div className="mx-auto mt-20 max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#101522]/90 shadow-2xl shadow-blue-950/30">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
            <div className="flex gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
            </div>

            <span className="text-xs text-slate-500">
              AI_POWERED COLLEGE ASSISTANT USING RAG · AI ASSISTANT
            </span>

            <span className="text-xs text-blue-300">
              {loading ? "● Thinking" : "● API connected"}
            </span>
          </div>

          <div className="grid md:grid-cols-[0.85fr_1.4fr]">
            {/* SIDEBAR */}
            <aside className="border-b border-white/[0.08] p-6 md:border-b-0 md:border-r">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Your workspace
              </p>

              <div className="mt-5 space-y-2">
                {[
                  "Academic support",
                  "College information",
                  "Study companion",
                ].map((item, index) => (
                  <div
                    key={item}
                    className={`rounded-xl px-3 py-3 text-sm ${
                      index === 0
                        ? "border border-blue-400/20 bg-blue-400/10 text-blue-100"
                        : "text-slate-400"
                    }`}
                  >
                    <span className="mr-3">
                      {["◈", "▤", "✧"][index]}
                    </span>
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                <p className="text-sm font-medium">
                  Designed around your needs
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  One place for college questions, documents, and learning support.
                </p>
              </div>

              {/* DOCUMENT MANAGEMENT */}
              <div className="mt-8 border-t border-white/[0.08] pt-6">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Knowledge base
                  </p>
                  <span className="rounded-full bg-blue-400/10 px-2 py-1 text-[10px] text-blue-300">
                    {documentTotal} PDFs
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-white/[0.08] bg-black/10 p-3">
                    <p className="text-xl font-semibold text-white">
                      {documentTotal}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Documents
                    </p>
                  </div>

                  <div className="rounded-lg border border-white/[0.08] bg-black/10 p-3">
                    <p className="text-xl font-semibold text-white">
                      {indexedChunks}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Indexed chunks
                    </p>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleUpload}
                  className="hidden"
                  aria-label="Select a PDF document"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/10 px-3 py-3 text-sm font-medium text-blue-200 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <span className="animate-spin">◌</span>
                      Uploading and indexing...
                    </>
                  ) : (
                    <>
                      <span>＋</span>
                      Upload PDF
                    </>
                  )}
                </button>

                <p className="mt-2 text-center text-[10px] text-slate-500">
                  PDF files only · Backend size limit applies
                </p>

                {documentStatus && (
                  <p
                    role="status"
                    className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-xs leading-5 text-emerald-300"
                  >
                    {documentStatus}
                  </p>
                )}

                {documentError && (
                  <p
                    role="alert"
                    className="mt-3 rounded-lg border border-red-400/20 bg-red-400/[0.06] p-3 text-xs leading-5 text-red-300"
                  >
                    {documentError}
                  </p>
                )}

                <div className="mt-5 flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-300">
                    Indexed documents
                  </p>

                  <button
                    type="button"
                    onClick={() => void refreshDocuments()}
                    disabled={documentsLoading}
                    className="text-[10px] text-blue-300 hover:text-blue-200 disabled:opacity-50"
                  >
                    ↻ Refresh
                  </button>
                </div>

                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                  {documentsLoading ? (
                    <p className="text-xs text-slate-500">
                      Loading documents...
                    </p>
                  ) : documents.length === 0 ? (
                    <p className="rounded-lg border border-white/[0.08] p-3 text-xs leading-5 text-slate-500">
                      No documents found. Upload a PDF to build your knowledge base.
                    </p>
                  ) : (
                    documents.map((document) => (
                      <div
                        key={document.id}
                        className="rounded-lg border border-white/[0.08] bg-black/10 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p
                              title={document.title}
                              className="break-words text-xs font-medium text-slate-200"
                            >
                              📄 {document.title}
                            </p>

                            <p className="mt-2 text-[10px] text-slate-500">
                              {document.pages_with_text} pages · {document.chunks} chunks
                            </p>
                          </div>

                          <button
                            type="button"
                            title="Delete document"
                            aria-label={`Delete ${document.title}`}
                            onClick={() => void handleDelete(document)}
                            disabled={deletingId !== null}
                            className="shrink-0 rounded-md px-2 py-1 text-xs text-red-300 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {deletingId === document.id ? "..." : "✕"}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </aside>

            {/* CHAT AREA */}
            <section id="assistant" className="min-w-0 p-5 sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/30 to-violet-500/30 text-lg">
                  ✦
                </div>

                <div>
                  <p className="text-sm font-semibold">
                    Your college companion
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {loading
                      ? "Waiting for the assistant..."
                      : "Ask a question to get started"}
                  </p>
                </div>
              </div>

              {/* RESPONSE LANGUAGE */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <label
                  htmlFor="response-language"
                  className="text-xs text-slate-400"
                >
                  Response language
                </label>

                <select
                  id="response-language"
                  value={language}
                  onChange={(event) =>
                    setLanguage(event.target.value as ChatLanguage)
                  }
                  disabled={loading}
                  className="rounded-lg border border-white/10 bg-[#090d17] px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-400/50"
                >
                  <option value="auto">Auto detect</option>
                  <option value="English">English</option>
                  <option value="Hindi">हिन्दी (Hindi)</option>
                  <option value="Marathi">मराठी (Marathi)</option>
                </select>
              </div>

              {messages.length === 0 ? (
                <>
                  <p className="mb-4 mt-7 text-sm text-slate-400">
                    What would you like help with today?
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {suggestions.map((item) => (
                      <button
                        key={item.title}
                        type="button"
                        disabled={loading}
                        onClick={() => void sendMessage(item.text)}
                        className="rounded-xl border border-white/[0.09] bg-white/[0.025] p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-blue-400/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="text-lg">{item.icon}</span>
                        <p className="mt-3 text-sm font-medium">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {item.text}
                        </p>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-6 max-h-[440px] space-y-4 overflow-y-auto pr-1">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`whitespace-pre-wrap break-words rounded-xl p-4 text-sm leading-6 ${
                        message.role === "user"
                          ? "ml-6 bg-blue-500/15 text-blue-50"
                          : "mr-3 border border-white/[0.08] bg-white/[0.03] text-slate-300"
                      }`}
                    >
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {message.role === "user" ? "You" : "AI_POWERED COLLEGE ASSISTANT USING RAG"}
                      </p>

                      {message.role === "assistant" && (
                        <div className="mb-3">
                          {message.grounded ? (
                            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-300">
                              ✓ Document-grounded answer
                            </span>
                          ) : (
                            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[10px] text-amber-300">
                              ⚠ Insufficient supporting evidence
                            </span>
                          )}
                        </div>
                      )}

                      <MarkdownContent content={message.text} />

                      {message.role === "assistant" && message.notice && (
                        <p className="mt-3 text-xs text-amber-300">
                          {message.notice}
                        </p>
                      )}

                      {message.role === "assistant" && (
                        <SourceList sources={message.sources ?? []} />
                      )}
                    </div>
                  ))}

                  {loading && (
                    <div
                      role="status"
                      className="mr-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-slate-400"
                    >
                      <span className="mr-2 inline-block animate-pulse text-blue-300">
                        ✦
                      </span>
                      Thinking and retrieving an answer...
                    </div>
                  )}
                </div>
              )}

              {/* CHAT ERROR */}
              {error && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm text-red-200"
                >
                  <p>{error}</p>

                  <button
                    type="button"
                    onClick={() => void sendMessage(lastQuestion)}
                    disabled={loading || !lastQuestion}
                    className="mt-3 rounded-full border border-red-300/20 px-4 py-2 text-xs font-medium transition hover:bg-red-400/10 disabled:opacity-50"
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* CHAT INPUT */}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendMessage();
                }}
                className="mt-5 flex items-center gap-3 rounded-xl border border-white/10 bg-[#090d17] p-2 focus-within:border-blue-400/50"
              >
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask anything about college..."
                  aria-label="Ask AI_POWERED COLLEGE ASSISTANT USING RAG a question"
                  disabled={loading}
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 disabled:opacity-60"
                />

                <button
                  type="submit"
                  aria-label="Send question"
                  disabled={loading || !question.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-lg transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "…" : "↑"}
                </button>
              </form>

              <p className="mt-3 text-center text-[10px] text-slate-600">
                Answers are generated using retrieved documents. Always verify important information against official college sources.
              </p>
            </section>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section
        id="features"
        className="relative z-10 border-t border-white/[0.07] bg-white/[0.015] px-6 py-20 md:px-12 md:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">
            A smarter campus experience
          </p>

          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">
            Everything starts with a better answer.
          </h2>

          <p className="mt-5 max-w-2xl leading-7 text-slate-400">
            Designed to bring college knowledge closer to the people who need it.
          </p>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: "⌘",
                title: "Academic clarity",
                desc: "Make complex academic information easier to understand.",
              },
              {
                icon: "◫",
                title: "Document-grounded answers",
                desc: "Build answers around approved college documents and traceable sources.",
              },
              {
                icon: "✧",
                title: "Learning support",
                desc: "Create a foundation for summaries, revision, and study assistance.",
              },
            ].map((feature) => (
              <article
                key={feature.title}
                className="rounded-2xl border border-white/[0.08] bg-[#101522]/60 p-7 transition duration-300 hover:-translate-y-1 hover:border-blue-400/30"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-400/[0.08] text-xl text-blue-300">
                  {feature.icon}
                </div>

                <h3 className="mt-6 text-lg font-semibold">
                  {feature.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {feature.desc}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        id="how-it-works"
        className="relative z-10 px-6 py-20 md:px-12 md:py-24"
      >
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300">
              Simple by design
            </p>

            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
              From question to clarity.
            </h2>

            <p className="mt-5 leading-7 text-slate-400">
              AI_POWERED COLLEGE ASSISTANT USING RAG retrieves relevant college information before responding,
              so users can review supporting sources.
            </p>
          </div>

          <div className="space-y-4">
            {[
              ["01", "Ask naturally", "Describe what you need in your own words."],
              ["02", "Find relevant sources", "Retrieve information from authorized college documents."],
              ["03", "Review the answer", "Read the response and check its supporting sources."],
            ].map(([number, title, description]) => (
              <div
                key={number}
                className="flex gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"
              >
                <span className="text-sm font-semibold text-blue-300">
                  {number}
                </span>

                <div>
                  <h3 className="font-medium">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/[0.08] px-6 py-8 md:px-12">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-sm text-slate-500 sm:flex-row">
          <p>© 2026 AI_POWERED COLLEGE ASSISTANT USING RAG. Built for a smarter campus.</p>
          <p>College knowledge, made accessible.</p>
        </div>
      </footer>
    </main>
  );
}
