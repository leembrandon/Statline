import Link from "next/link";
import { query, supabase } from "@/lib/supabase";
import { fmt } from "@/lib/utils";

export const revalidate = 300;

export const metadata = {
  title: "NBA Player Leaders — StatLine",
  description: "NBA player stats leaderboard. Points, rebounds, assists, and more.",
};

async function getData() {
  const stats = await query("nba_player_stats", { order: { column: "points_per_game", ascending: false }, limit: 100 });
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
      <Link href="/nba" className="text-[12px] font-semibold mb-3 inline-block" style={{ color: "var(--accent)" }}>← NBA</Link>
      <h1 className="text-[24px] sm:text-[28px] font-extrabold mb-5" style={{ color: "var(--text-bright)" }}>Player Leaders</h1>

      {/* ── Mobile: Cards ── */}
      <div className="sm:hidden space-y-2">
        {stats.map((s, i) => {
          const p = playerMap[s.player_id] || {};
          return (
            <Link
              key={s.id}
              href={`/nba/players/${p.espn_id || s.player_id?.replace("nba_", "")}`}
              className="block rounded-2xl p-3 card-hover"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-3">
                <span className="stat-num text-[11px] w-5 text-center font-bold flex-shrink-0" style={{ color: i < 3 ? "var(--accent)" : i < 10 ? "var(--green)" : "var(--text-dim)" }}>{i + 1}</span>
                {p.headshot_url ? (
                  <img src={p.headshot_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" style={{ background: "var(--bg-surface)" }} />
                ) : (
                  <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ background: "var(--bg-surface)" }} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold truncate" style={{ color: "var(--text-bright)" }}>{p.name || "?"}</div>
                  <div className="text-[11px]" style={{ color: "var(--text-dim)" }}>{p.position} · {s.games_played} GP</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="stat-num text-[18px]" style={{ color: "var(--text-bright)" }}>{fmt(s.points_per_game, 1)}</div>
                  <div className="text-[10px] font-semibold" style={{ color: "var(--text-dim)" }}>PPG</div>
                </div>
              </div>
              <div className="flex justify-between mt-2.5 pt-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                {[
                  { label: "REB", val: s.rebounds_per_game },
                  { label: "AST", val: s.assists_per_game },
                  { label: "FG%", val: s.fg_pct },
                  { label: "3P%", val: s.fg3_pct },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="stat-num text-[12px]">{fmt(stat.val, 1)}</div>
                    <div className="text-[9px] font-semibold" style={{ color: "var(--text-dim)" }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Tablet+: Table ── */}
      <div className="hidden sm:block rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center px-4 py-2" style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border)" }}>
          <span className="text-[10px] font-semibold w-7 flex-shrink-0" style={{ color: "var(--text-dim)" }}>#</span>
          <span className="text-[10px] font-semibold flex-1" style={{ color: "var(--text-dim)" }}>Player</span>
          {["GP", "PTS", "REB", "AST", "STL", "BLK", "FG%", "3P%", "FT%"].map((h, idx) => (
            <span
              key={h}
              className={`text-[10px] font-semibold w-12 text-center ${idx >= 4 && idx < 6 ? "hidden lg:block" : ""} ${idx >= 6 ? "hidden md:block" : ""}`}
              style={{ color: "var(--text-dim)" }}
            >
              {h}
            </span>
          ))}
        </div>

        {stats.map((s, i) => {
          const p = playerMap[s.player_id] || {};
          return (
            <Link
              key={s.id}
              href={`/nba/players/${p.espn_id || s.player_id?.replace("nba_", "")}`}
              className="flex items-center px-4 py-2 card-hover"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <span className="stat-num text-[11px] w-7 font-bold flex-shrink-0" style={{ color: i < 3 ? "var(--accent)" : i < 10 ? "var(--green)" : "var(--text-dim)" }}>{i + 1}</span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {p.headshot_url ? (
                  <img src={p.headshot_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" style={{ background: "var(--bg-surface)" }} />
                ) : (
                  <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ background: "var(--bg-surface)" }} />
                )}
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold truncate" style={{ color: "var(--text-bright)" }}>{p.name || "?"}</div>
                  <div className="text-[10px]" style={{ color: "var(--text-dim)" }}>{p.position} · {p.team_id?.replace("nba_", "").toUpperCase()}</div>
                </div>
              </div>
              <span className="stat-num text-[12px] w-12 text-center" style={{ color: "var(--text-dim)" }}>{s.games_played}</span>
              <span className="stat-num text-[13px] w-12 text-center font-bold" style={{ color: "var(--text-bright)" }}>{fmt(s.points_per_game, 1)}</span>
              <span className="stat-num text-[12px] w-12 text-center">{fmt(s.rebounds_per_game, 1)}</span>
              <span className="stat-num text-[12px] w-12 text-center">{fmt(s.assists_per_game, 1)}</span>
              <span className="stat-num text-[12px] w-12 text-center hidden lg:block">{fmt(s.steals_per_game, 1)}</span>
              <span className="stat-num text-[12px] w-12 text-center hidden lg:block">{fmt(s.blocks_per_game, 1)}</span>
              <span className="stat-num text-[12px] w-12 text-center hidden md:block">{fmt(s.fg_pct, 1)}</span>
              <span className="stat-num text-[12px] w-12 text-center hidden md:block">{fmt(s.fg3_pct, 1)}</span>
              <span className="stat-num text-[12px] w-12 text-center hidden md:block">{fmt(s.ft_pct, 1)}</span>
            </Link>
          );
        })}
      </div>

      {stats.length === 0 && (
        <div className="text-center py-16" style={{ color: "var(--text-dim)" }}>
          <p>No player stats yet. Run the sync script.</p>
        </div>
      )}
    </div>
  );
}
