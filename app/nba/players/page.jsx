import Link from "next/link";
import { query, supabase } from "@/lib/supabase";
import { fmt } from "@/lib/utils";

export const revalidate = 300;

export const metadata = {
  title: "NBA Player Leaders — StatLine",
  description: "NBA player stats leaderboard. Points, rebounds, assists, and more.",
};

async function getData() {
  const stats = await query("nba_player_stats", {
    order: { column: "points_per_game", ascending: false },
    limit: 100,
  });
  const playerIds = stats.map((s) => s.player_id);
  let players = [];
  if (playerIds.length) {
    const { data } = await supabase.from("players").select("*").in("id", playerIds);
    players = data || [];
  }
  const playerMap = {};
  players.forEach((p) => (playerMap[p.id] = p));
  return { stats, playerMap };
}

export default async function NBAPlayers() {
  const { stats, playerMap } = await getData();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/nba" className="text-xs mb-1 inline-block" style={{ color: "var(--accent)" }}>← NBA</Link>
          <h1 className="text-xl font-black text-white">Player Leaders</h1>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="px-3 py-2 grid items-center" style={{ gridTemplateColumns: "28px 1fr 48px 48px 48px 48px 48px 48px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--border)" }}>
          <span className="text-xs" style={{ color: "var(--text-dim)" }}>#</span>
          <span className="text-xs" style={{ color: "var(--text-dim)" }}>Player</span>
          <span className="text-xs text-center" style={{ color: "var(--text-dim)" }}>GP</span>
          <span className="text-xs text-center font-bold" style={{ color: "var(--text-dim)" }}>PTS</span>
          <span className="text-xs text-center" style={{ color: "var(--text-dim)" }}>REB</span>
          <span className="text-xs text-center" style={{ color: "var(--text-dim)" }}>AST</span>
          <span className="text-xs text-center hidden sm:block" style={{ color: "var(--text-dim)" }}>FG%</span>
          <span className="text-xs text-center hidden sm:block" style={{ color: "var(--text-dim)" }}>3P%</span>
        </div>

        {stats.map((s, i) => {
          const p = playerMap[s.player_id] || {};
          return (
            <Link key={s.id} href={`/nba/players/${p.espn_id || s.player_id?.replace("nba_", "")}`} className="block hover:bg-white/3">
              <div className="px-3 py-2 grid items-center" style={{ gridTemplateColumns: "28px 1fr 48px 48px 48px 48px 48px 48px", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                <span className="text-xs font-bold" style={{ color: i < 3 ? "var(--accent)" : i < 10 ? "var(--green)" : "var(--text-dim)" }}>{i + 1}</span>
                <div className="flex items-center gap-2 min-w-0">
                  {p.headshot_url && <img src={p.headshot_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{p.name || "?"}</div>
                    <div className="text-xs" style={{ color: "var(--text-dim)" }}>{p.position}</div>
                  </div>
                </div>
                <span className="text-xs text-center">{s.games_played}</span>
                <span className="text-sm text-center font-bold text-white">{fmt(s.points_per_game, 1)}</span>
                <span className="text-xs text-center">{fmt(s.rebounds_per_game, 1)}</span>
                <span className="text-xs text-center">{fmt(s.assists_per_game, 1)}</span>
                <span className="text-xs text-center hidden sm:block">{fmt(s.fg_pct, 1)}</span>
                <span className="text-xs text-center hidden sm:block">{fmt(s.fg3_pct, 1)}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {stats.length === 0 && (
        <div className="text-center py-12 opacity-40">
          <p>No player stats yet. Run the sync script.</p>
        </div>
      )}
    </div>
  );
}
