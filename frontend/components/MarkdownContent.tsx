
import ReactMarkdown from "react-markdown";

type MarkdownContentProps = {
  content: string;
};

export default function MarkdownContent({
  content,
}: MarkdownContentProps) {
  return (
    <div className="space-y-3 break-words text-sm leading-7 text-slate-300">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="mt-5 text-xl font-bold text-white">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-4 text-lg font-semibold text-white">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 text-base font-semibold text-blue-200">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="leading-7">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">
              {children}
            </strong>
          ),
          ul: ({ children }) => (
            <ul className="ml-5 list-disc space-y-2">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="ml-5 list-decimal space-y-2">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="pl-1">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-blue-400 pl-4 italic text-slate-400">
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => (
            <code
              className={`rounded bg-black/30 px-1.5 py-1 font-mono text-blue-200 ${
                className ?? ""
              }`}
            >
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-xl border border-white/10 bg-[#080b14] p-4 text-xs leading-6">
              {children}
            </pre>
          ),
          hr: () => (
            <hr className="border-white/10" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
