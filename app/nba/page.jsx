import Link from "next/link";
import { query, supabase } from "@/lib/supabase";
import { fmt } from "@/lib/utils";

export const revalidate = 300;

export const metadata = {
  title: "NBA Stats — StatLine",
  description: "NBA scores, standings, player stats, and comparisons.",
};

async function getData() {
  const [games, standings, leaders] = await Promise.all([
    query("games", {
      eq: { sport: "nba" },
      order: { column: "start_time", ascending: false },
      limit: 12,
    }),
    query("standings", {
      eq: { sport: "nba" },
      order: { column: "conference_rank", ascending: true },
    }),
    query("nba_player_stats", {
      order: { column: "points_per_game", ascending: false },
      limit: 10,
    }),
  ]);

  const playerIds = leaders.map((l) => l.player_id);
  const teamIds = [
    ...new Set([
      ...standings.map((s) => s.team_id),
      ...games.map((g) => g.home_team_id),
      ...games.map((g) => g.away_team_id),
    ]),
  ].filter(Boolean);

  let teams = [];
  if (teamIds.length > 0) {
    const { data } = await supabase.from("teams").select("*").in("id", teamIds);
    teams = data || [];
  }

  let players = [];
  if (playerIds.length > 0) {
    const { data } = await supabase
      .from("players")
      .select("*")
      .in("id", playerIds);
    players = data || [];
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
  const isScheduled = game.status === "scheduled";
  const homeTeam = teamMap[game.home_team_id] || {};
  const awayTeam = teamMap[game.away_team_id] || {};
  const homeWon = isFinal && game.home_score > game.away_score;
  const awayWon = isFinal && game.away_score > game.home_score;

  return (
    <div
      className="flex-shrink-0 w-[168px] rounded-2xl p-3 card-hover"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between mb-2.5">
        {isLive ? (
          <div className="flex items-center gap-1.5">
            <span
              className="live-dot w-1.5 h-1.5 rounded-full inline-block"
              style={{ background: "var(--red)" }}
            />
            <span className="text-[10px] font-bold uppercase" style={{ color: "var(--red)" }}>
              Live
            </span>
          </div>
        ) : isFinal ? (
          <span className="text-[10px] font-semibold uppercase" style={{ color: "var(--text-dim)" }}>
            Final
          </span>
        ) : (
          <span className="text-[10px] font-semibold" style={{ color: "var(--text-dim)" }}>
            {game.status_detail || "Scheduled"}
          </span>
        )}
      </div>

      {[
        { team: awayTeam, score: game.away_score, won: awayWon },
        { team: homeTeam, score: game.home_score, won: homeWon },
      ].map(({ team, score, won }, idx) => (
        <div
          key={idx}
          className={`flex items-center justify-between ${idx === 0 ? "mb-1.5" : ""}`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {team.logo_url ? (
              <img src={team.logo_url} alt="" className="w-5 h-5 flex-shrink-0" />
            ) : (
              <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: "var(--bg-surface)" }} />
            )}
            <span
              className="text-[13px] font-bold truncate"
              style={{
                color: won ? "var(--text-bright)" : isFinal ? "var(--text-dim)" : "var(--text-bright)",
              }}
            >
              {team.abbreviation || "TBD"}
            </span>
          </div>
          {!isScheduled && (
            <span
              className="stat-num text-[15px]"
              style={{
                color: won ? "var(--text-bright)" : isFinal ? "var(--text-dim)" : "var(--text-bright)",
              }}
            >
              {score}
            </span>
          )}
        </div>
      ))}
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

  const east = standings.filter((s) => {
    const t = teamMap[s.team_id];
    return t?.conference?.toLowerCase().includes("east");
  });
  const west = standings.filter((s) => {
    const t = teamMap[s.team_id];
    return t?.conference?.toLowerCase().includes("west");
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🏀</span>
            <h1
              className="text-[22px] font-extrabold tracking-tight"
              style={{ color: "var(--text-bright)" }}
            >
              NBA
            </h1>
          </div>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-dim)" }}>
            2024-25 Season
          </p>
        </div>
        <div className="flex gap-1.5">
          {[
            { href: "/nba/standings", label: "Standings" },
            { href: "/nba/players", label: "Players" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-colors hover:bg-white/5"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "var(--text)",
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Scores */}
      {games.length > 0 && (
        <section className="mb-7">
          <h2
            className="text-[15px] font-bold mb-3"
            style={{ color: "var(--text-bright)" }}
          >
            Recent Scores
          </h2>
          <div className="scroll-strip -mx-4 px-4">
            <div className="flex gap-2.5 pb-1" style={{ width: "max-content" }}>
              {games.map((g) => (
                <ScoreCard key={g.id} game={g} teamMap={teamMap} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Standings */}
      {standings.length > 0 && (
        <section className="mb-7">
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-[15px] font-bold"
              style={{ color: "var(--text-bright)" }}
            >
              Standings
            </h2>
            <Link
              href="/nba/standings"
              className="text-[12px] font-semibold"
              style={{ color: "var(--accent)" }}
            >
              Full standings →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "Eastern Conference", data: east },
              { label: "Western Conference", data: west },
            ].map(({ label, data: conf }) => (
              <div
                key={label}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  className="px-3 py-2"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {label}
                  </span>
                </div>
                {conf.map((s, i) => {
                  const t = teamMap[s.team_id] || {};
                  const rank = s.conference_rank || i + 1;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 px-3 py-2"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <span
                        className="stat-num text-[11px] w-5 text-center font-bold"
                        style={{
                          color:
                            rank <= 6
                              ? "var(--accent)"
                              : rank <= 10
                                ? "var(--green)"
                                : "var(--text-dim)",
                        }}
                      >
                        {rank}
                      </span>
                      {t.logo_url && (
                        <img src={t.logo_url} alt="" className="w-4 h-4 flex-shrink-0" />
                      )}
                      <span
                        className="text-[12px] font-semibold flex-1 truncate"
                        style={{ color: "var(--text-bright)" }}
                      >
                        {t.abbreviation || "?"}
                      </span>
                      <span className="stat-num text-[12px] w-8 text-center" style={{ color: "var(--text-bright)" }}>
                        {s.wins}
                      </span>
                      <span className="stat-num text-[12px] w-8 text-center" style={{ color: "var(--text-dim)" }}>
                        {s.losses}
                      </span>
                      <span
                        className="stat-num text-[12px] w-10 text-right"
                        style={{
                          color:
                            s.pct >= 0.6
                              ? "var(--green)"
                              : s.pct < 0.4
                                ? "var(--red)"
                                : "var(--text)",
                        }}
                      >
                        {fmt(s.pct, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Scoring Leaders */}
      {leaders.length > 0 && (
        <section className="mb-7">
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-[15px] font-bold"
              style={{ color: "var(--text-bright)" }}
            >
              Scoring Leaders
            </h2>
            <Link
              href="/nba/players"
              className="text-[12px] font-semibold"
              style={{ color: "var(--accent)" }}
            >
              View all →
            </Link>
          </div>
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
            }}
          >
            {leaders.map((l, i) => {
              const p = playerMap[l.player_id] || {};
              return (
                <Link
                  key={l.id}
                  href={`/nba/players/${p.espn_id || l.player_id?.replace("nba_", "")}`}
                  className="flex items-center gap-3 px-3 py-2.5 card-hover"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <span
                    className="stat-num text-[11px] w-5 text-center font-bold"
                    style={{
                      color: i < 3 ? "var(--accent)" : "var(--text-dim)",
                    }}
                  >
                    {i + 1}
                  </span>
                  {p.headshot_url ? (
                    <img
                      src={p.headshot_url}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      style={{ background: "var(--bg-surface)" }}
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full flex-shrink-0"
                      style={{ background: "var(--bg-surface)" }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[13px] font-semibold truncate"
                      style={{ color: "var(--text-bright)" }}
                    >
                      {p.name || l.player_id}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--text-dim)" }}>
                      {p.position} · {p.team_id?.replace("nba_", "").toUpperCase()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="stat-num text-[16px]" style={{ color: "var(--text-bright)" }}>
                      {fmt(l.points_per_game, 1)}
                    </div>
                    <div className="text-[10px] font-semibold" style={{ color: "var(--text-dim)" }}>
                      PPG
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="stat-num text-[13px]">{fmt(l.rebounds_per_game, 1)}</div>
                    <div className="text-[10px]" style={{ color: "var(--text-dim)" }}>RPG</div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="stat-num text-[13px]">{fmt(l.assists_per_game, 1)}</div>
                    <div className="text-[10px]" style={{ color: "var(--text-dim)" }}>APG</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {standings.length === 0 && leaders.length === 0 && games.length === 0 && (
        <div className="text-center py-16" style={{ color: "var(--text-dim)" }}>
          <p className="text-base mb-2">No data yet</p>
          <p className="text-[13px]">
            Run:{" "}
            <code
              className="px-2 py-0.5 rounded-md text-[12px]"
              style={{ background: "var(--bg-surface)", color: "var(--accent)" }}
            >
              python sync_nba.py
            </code>
          </p>
        </div>
      )}
    </div>
  );
}
