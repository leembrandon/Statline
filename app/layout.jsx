import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "StatLine — Sports Stats Hub",
  description:
    "NBA, NFL, and MLB stats made simple. Compare players, check scores, and share stats.",
};

function TopNav() {
  return (
    <nav
      className="sticky top-0 z-50 backdrop-blur-2xl border-b"
      style={{
        background: "rgba(7,7,15,0.85)",
        borderColor: "var(--border)",
      }}
    >
      <div className="max-w-3xl mx-auto px-4 h-13 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs text-white"
            style={{ background: "var(--accent)" }}
          >
            S
          </div>
          <span
            className="text-[15px] font-bold tracking-tight"
            style={{ color: "var(--text-bright)" }}
          >
            STATLINE
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-0.5">
          {[
            { href: "/", label: "Home" },
            { href: "/nba", label: "NBA" },
            { href: "/nba/standings", label: "Standings" },
            { href: "/nba/players", label: "Players" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors hover:bg-white/5"
              style={{ color: "var(--text)" }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

function BottomNav() {
  return (
    <nav
      className="sm:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-2xl border-t"
      style={{
        background: "rgba(7,7,15,0.92)",
        borderColor: "var(--border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex items-center justify-around h-14">
        {[
          {
            href: "/",
            label: "Home",
            d: "M3 9.5L12 3l9 6.5V20a2 2 0 01-2 2H5a2 2 0 01-2-2V9.5z",
          },
          {
            href: "/nba/standings",
            label: "Standings",
            d: "M3 6h18M3 12h12M3 18h8",
          },
          {
            href: "/nba/players",
            label: "Players",
            d: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2M13 7a4 4 0 11-8 0 4 4 0 018 0zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
          },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex flex-col items-center gap-0.5 px-5 py-1.5"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--text-dim)" }}
            >
              <path d={tab.d} />
            </svg>
            <span
              className="text-[10px] font-semibold"
              style={{ color: "var(--text-dim)" }}
            >
              {tab.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#07070f" />
      </head>
      <body>
        <TopNav />
        <main className="max-w-3xl mx-auto px-4 pt-5 pb-24 sm:pb-10">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
