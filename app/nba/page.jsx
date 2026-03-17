import Link from "next/link";
import { query } from "@/lib/supabase";
import { fmt, record } from "@/lib/utils";

export const revalidate = 300;

export const metadata = {
  title: "NBA Stats — StatLine",
  description: "NBA scores, standings, player stats, and comparisons.",
};

async function getData() {
  const [games, standings, leaders] = await Promise.all([
    query("games", { eq: { sport: "nba" }, order: { column: "start_time", ascending: false }, limit: 12 }),
    query("standings", { eq: { sport: "nba" }, order: { column: "conference_rank", ascending: true } }),
    query("nba_player_stats", { order: { column: "points_per_game", ascending: false }, limit: 10 }),
  ]);
  // Get team info for the leaders
  const playerIds = leaders.map((l) => l.player_id);
  let players = [];
  if (playerIds.length > 0) {
    const { data } = await (await import("@/lib/supabase")).supabase
      .from("players")
      .select("*")
      .in("id", playerIds);
    players = data || [];
  }
  // Get team info for standings
  const teamIds = standings.map((s) => s.team_id);
  let teams = [];
  if (teamIds.length > 0) {
    const { data } = await (await import("@/lib/supabase")).supabase
      .from("teams")
      .select("*")
      .in("id", teamIds);
    teams = data || [];
  }
  const teamMap = {};
  teams.forEach((t) => (teamMap[t.id] = t));
  const playerMap = {};
  players.forEach((p) => (playerMap[p.id] = p));

  return { games, standings, leaders, teamMap, playerMap };
}

function ScoreCard({ game, teamMap }) {
  const isFinal = game.status === "final";
  const isLive = game.status === "in_progress";
  const homeTeam = teamMap[game.home_team_id] || {};
  const awayTeam = teamMap[game.away_team_id] || {};
  const homeWon = isFinal && game.home_score > game.away_score;
  const awayWon = isFinal && game.away_score > game.home_score;

  return (
    <div className="rounded-xl p-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs" style={{ color: "var(--text-dim)" }}>{game.status_detail}</span>
        {isLive && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,59,48,0.15)", color: "#ff3b30" }}>LIVE</span>}
        {isFinal && <span className="text-xs" style={{ color: "var(--text-dim)" }}>Final</span>}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {awayTeam.logo_url && <img src={awayTeam.logo_url} alt="" className="w-5 h-5" />}
            <span className={`text-sm font-semibold ${awayWon ? "text-white" : ""}`} style={{ opacity: isFinal && !awayWon ? 0.5 : 1 }}>{awayTeam.abbreviation || "AWY"}</span>
          </div>
          <span className={`text-base font-bold ${awayWon ? "text-white" : ""}`} style={{ opacity: isFinal && !awayWon ? 0.5 : 1 }}>{game.away_score}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {homeTeam.logo_url && <img src={homeTeam.logo_url} alt="" className="w-5 h-5" />}
            <span className={`text-sm font-semibold ${homeWon ? "text-white" : ""}`} style={{ opacity: isFinal && !homeWon ? 0.5 : 1 }}>{homeTeam.abbreviation || "HME"}</span>
          </div>
          <span className={`text-base font-bold ${homeWon ? "text-white" : ""}`} style={{ opacity: isFinal && !homeWon ? 0.5 : 1 }}>{game.home_score}</span>
        </div>
      </div>
    </div>
  );
}

export default async function NBAHome() {
  let data = { games: [], standings: [], leaders: [], teamMap: {}, playerMap: {} };
  try {
    data = await getData();
  } catch (e) {
    console.error("NBA data error:", e);
  }

  const { games, standings, leaders, teamMap, playerMap } = data;

  // Split standings by conference
  const east = standings.filter((s) => {
    const t = teamMap[s.team_id];
    return t && t.conference && t.conference.toLowerCase().includes("east");
  });
  const west = standings.filter((s) => {
    const t = teamMap[s.team_id];
    return t && t.conference && t.conference.toLowerCase().includes("west");
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">🏀 NBA</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>2024-25 Season</p>
        </div>
        <div className="flex gap-2">
          <Link href="/nba/standings" className="px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-white/5" style={{ background: "rgba(255,255,255,0.05)" }}>Standings</Link>
          <Link href="/nba/players" className="px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-white/5" style={{ background: "rgba(255,255,255,0.05)" }}>Players</Link>
          <Link href="/nba/compare" className="px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-white/5" style={{ background: "rgba(255,255,255,0.05)" }}>Compare</Link>
        </div>
      </div>

      {/* Scores */}
      {games.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-white mb-3">Recent Scores</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {games.slice(0, 8).map((g) => (
              <ScoreCard key={g.id} game={g} teamMap={teamMap} />
            ))}
          </div>
        </div>
      )}

      {/* Standings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {[{ label: "Eastern Conference", data: east }, { label: "Western Conference", data: west }].map(({ label, data: conf }) => (
          <div key={label} className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="px-3 py-2" style={{ background: "rgba(255,255,255,0.03)" }}>
              <span className="text-xs font-bold text-white uppercase tracking-wider">{label}</span>
            </div>
            <div className="px-3 py-1" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="grid items-center text-xs" style={{ gridTemplateColumns: "24px 1fr 40px 40px 50px", color: "var(--text-dim)" }}>
                <span>#</span><span>Team</span><span className="text-center">W</span><span className="text-center">L</span><span className="text-center">PCT</span>
              </div>
            </div>
            {conf.map((s, i) => {
              const t = teamMap[s.team_id] || {};
              return (
                <div key={s.id} className="px-3 py-1.5 hover:bg-white/3" style={{ borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                  <div className="grid items-center text-sm" style={{ gridTemplateColumns: "24px 1fr 40px 40px 50px" }}>
                    <span className="font-bold" style={{ color: i < 6 ? "var(--accent)" : i < 10 ? "var(--green)" : "var(--text-dim)", fontSize: "12px" }}>{s.conference_rank || i + 1}</span>
                    <div className="flex items-center gap-2 min-w-0">
                      {t.logo_url && <img src={t.logo_url} alt="" className="w-4 h-4 flex-shrink-0" />}
                      <span className="font-semibold text-white truncate text-xs">{t.abbreviation || "?"}</span>
                    </div>
                    <span className="text-center text-xs">{s.wins}</span>
                    <span className="text-center text-xs">{s.losses}</span>
                    <span className="text-center text-xs font-semibold" style={{ color: s.pct >= 0.6 ? "var(--green)" : s.pct < 0.4 ? "var(--red)" : "var(--text)" }}>{fmt(s.pct, 3)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Scoring Leaders */}
      {leaders.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white">Scoring Leaders</h2>
            <Link href="/nba/players" className="text-xs font-semibold" style={{ color: "var(--accent)" }}>View all →</Link>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            {leaders.map((l, i) => {
              const p = playerMap[l.player_id] || {};
              return (
                <div key={l.id} className="flex items-center gap-3 px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <span className="text-xs font-bold w-5" style={{ color: i < 3 ? "var(--accent)" : "var(--text-dim)" }}>{i + 1}</span>
                  {p.headshot_url && <img src={p.headshot_url} alt="" className="w-8 h-8 rounded-full object-cover" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{p.name || l.player_id}</div>
                    <div className="text-xs" style={{ color: "var(--text-dim)" }}>{p.position} · {p.team_id?.replace("nba_", "")}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold text-white">{fmt(l.points_per_game, 1)}</div>
                    <div className="text-xs" style={{ color: "var(--text-dim)" }}>PPG</div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-semibold">{fmt(l.rebounds_per_game, 1)}</div>
                    <div className="text-xs" style={{ color: "var(--text-dim)" }}>RPG</div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-semibold">{fmt(l.assists_per_game, 1)}</div>
                    <div className="text-xs" style={{ color: "var(--text-dim)" }}>APG</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {standings.length === 0 && leaders.length === 0 && games.length === 0 && (
        <div className="text-center py-12 opacity-40">
          <p className="text-lg mb-2">No data yet</p>
          <p className="text-sm">Run: <code className="px-2 py-1 rounded bg-white/5">python sync_nba.py</code></p>
        </div>
      )}
    </div>
  );
}
