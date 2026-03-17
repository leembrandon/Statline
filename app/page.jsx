import Link from "next/link";
import { query } from "@/lib/supabase";

export const revalidate = 300; // Revalidate every 5 minutes

async function getRecentGames() {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const games = await query("games", {
    eq: { sport: "nba" },
    order: { column: "start_time", ascending: false },
    limit: 20,
  });
  return games;
}

function ScoreCard({ game }) {
  const isFinal = game.status === "final";
  const isLive = game.status === "in_progress";
  const homeWon = isFinal && game.home_score > game.away_score;
  const awayWon = isFinal && game.away_score > game.home_score;

  return (
    <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: "var(--text-dim)" }}>
          {game.status_detail || new Date(game.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}
        </span>
        {isLive && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,59,48,0.15)", color: "#ff3b30" }}>LIVE</span>}
      </div>
      <div className="space-y-2 mt-2">
        <div className="flex items-center justify-between">
          <span className={`text-sm font-semibold ${awayWon ? "text-white" : ""}`} style={{ opacity: isFinal && !awayWon ? 0.5 : 1 }}>
            {game.away_team_id?.replace("nba_", "") || "Away"}
          </span>
          <span className={`text-lg font-bold ${awayWon ? "text-white" : ""}`} style={{ opacity: isFinal && !awayWon ? 0.5 : 1 }}>
            {game.away_score}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-sm font-semibold ${homeWon ? "text-white" : ""}`} style={{ opacity: isFinal && !homeWon ? 0.5 : 1 }}>
            {game.home_team_id?.replace("nba_", "") || "Home"}
          </span>
          <span className={`text-lg font-bold ${homeWon ? "text-white" : ""}`} style={{ opacity: isFinal && !homeWon ? 0.5 : 1 }}>
            {game.home_score}
          </span>
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  let games = [];
  try {
    games = await getRecentGames();
  } catch (e) {
    console.error("Failed to fetch games:", e);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white mb-1">Welcome to StatLine</h1>
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>Sports stats made simple. Start with NBA.</p>
      </div>

      <div className="mb-6">
        <Link href="/nba" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "var(--accent)" }}>
          🏀 Explore NBA
        </Link>
      </div>

      {games.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-white mb-3">Recent Scores</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {games.slice(0, 9).map((g) => (
              <ScoreCard key={g.id} game={g} />
            ))}
          </div>
        </div>
      )}

      {games.length === 0 && (
        <div className="text-center py-12 opacity-40">
          <p className="text-lg mb-2">No games yet</p>
          <p className="text-sm">Run the sync script to pull NBA data: <code className="px-2 py-1 rounded bg-white/5">python sync_nba.py</code></p>
        </div>
      )}
    </div>
  );
}
