
const navigation = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Try assistant", href: "#assistant" },
];

export default function SiteHeader() {
  return (
    <header className="relative z-20 flex min-h-[76px] w-full items-center justify-between gap-4 border-b border-white/[0.08] px-5 py-3 md:px-12">
      <a
        href="#"
        className="flex min-w-0 items-center gap-3"
        aria-label="AI College Assistant home"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-violet-500 text-xl font-bold">
          ✦
        </span>

        <span className="truncate text-base font-semibold tracking-tight text-white sm:text-lg">
          AI College Assistant
          <span className="text-blue-400">.</span>
        </span>
      </a>

      <nav className="hidden shrink-0 items-center gap-6 text-sm text-slate-400 lg:flex">
        {navigation.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="transition hover:text-white"
          >
            {item.label}
          </a>
        ))}
      </nav>

      <a
        href="#assistant"
        className="shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2.5 text-xs font-medium text-white transition hover:border-blue-400/50 sm:px-5 sm:text-sm"
      >
        Get started ↗
      </a>
    </header>
  );
}
