import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "StatLine — Sports Stats Hub",
  description: "NBA, NFL, and MLB stats made simple. Compare players, check scores, and share stats.",
};

function Nav() {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl border-b" style={{ background: "rgba(10,10,20,0.9)", borderColor: "var(--border)" }}>
      <div className="max-w-5xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight" style={{ color: "var(--accent)" }}>STATLINE</span>
          </Link>
          <div className="flex gap-1">
            <Link href="/nba" className="px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-white/5 transition-colors">
              🏀 NBA
            </Link>
            <Link href="/nfl" className="px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-white/5 transition-colors opacity-40 pointer-events-none">
              🏈 NFL
            </Link>
            <Link href="/mlb" className="px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-white/5 transition-colors opacity-40 pointer-events-none">
              ⚾ MLB
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="max-w-5xl mx-auto px-4 py-6">
          {children}
        </main>
        <footer className="text-center py-6 mt-8" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-xs" style={{ color: "var(--text-dim)" }}>StatLine · Sports stats made simple</p>
        </footer>
      </body>
    </html>
  );
}
