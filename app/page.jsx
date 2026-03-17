import Link from "next/link";
import { query, supabase } from "@/lib/supabase";
import { fmt, formatTime, formatDate } from "@/lib/utils";

export const revalidate = 300;

async function getData() {
  const [games, standings, scoringLeaders, assistLeaders, reboundLeaders] =
    await Promise.all([
      query("games", {
        order: { column: "start_time", ascending: false },
        limit: 20,
      }),
      query("standings", {
        order: { column: "conference_rank", ascending: true },
      }),
      query("nba_player_stats", {
        order: { column: "points_per_game", ascending: false },
        limit: 5,
      }),
      query("nba_player_stats", {
        order: { column: "assists_per_game", ascending: false },
        limit: 5,
      }),
      query("nba_player_stats", {
        order: { column: "rebounds_per_game", ascending: false },
        limit: 5,
      }),
    ]);

  const allPlayerIds = [
    ...new Set([
      ...scoringLeaders.map((l) => l.player_id),
      ...assistLeaders.map((l) => l.player_id),
      ...reboundLeaders.map((l) => l.player_id),
    ]),
  ];

  const allTeamIds = [
    ...new Set([
      ...standings.map((s) => s.team_id),
      ...games.map((g) => g.home_team_id),
      ...games.map((g) => g.away_team_id),
    ]),
  ].filter(Boolean);

  let teams = [];
  if (allTeamIds.length > 0) {
    const { data } = await supabase.from("teams").select("*").in("id", allTeamIds);
    teams = data || [];
  }

  let players = [];
  if (allPlayerIds.length > 0) {
    const { data } = await supabase.from("players").select("*").in("id", allPlayerIds);
    players = data || [];
  }

  const teamMap = {};
  teams.forEach((t) => (teamMap[t.id] = t));
  const playerMap = {};
  players.forEach((p) => (playerMap[p.id] = p));

  return { games, standings, scoringLeaders, assistLeaders, reboundLeaders, teamMap, playerMap };
}

/* ─── Score Card ─── */
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
      className="flex-shrink-0 w-[172px] lg:w-auto lg:flex-shrink rounded-2xl p-3 card-hover"
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${isLive ? "rgba(255,92,92,0.2)" : "var(--border)"}`,
      }}
    >
      <div className="flex items-center justify-between mb-2.5">
        {isLive ? (
          <div className="flex items-center gap-1.5">
            <span className="live-dot w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--red)" }} />
            <span className="text-[10px] font-bold uppercase" style={{ color: "var(--red)" }}>Live</span>
          </div>
        ) : isFinal ? (
          <span className="text-[10px] font-semibold uppercase" style={{ color: "var(--text-dim)" }}>Final</span>
        ) : (
          <span className="text-[10px] font-semibold" style={{ color: "var(--text-dim)" }}>{formatTime(game.start_time)}</span>
        )}
        <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>{formatDate(game.start_time)}</span>
      </div>

      {[
        { team: awayTeam, score: game.away_score, won: awayWon },
        { team: homeTeam, score: game.home_score, won: homeWon },
      ].map(({ team, score, won }, idx) => (
        <div key={idx} className={`flex items-center justify-between ${idx === 0 ? "mb-1.5" : ""}`}>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {team.logo_url ? (
              <img src={team.logo_url} alt="" className="w-5 h-5 flex-shrink-0" />
            ) : (
              <div className="w-5 h-5 rounded bg-white/5 flex-shrink-0" />
            )}
            <span
              className="text-[13px] font-bold truncate"
              style={{ color: won ? "var(--text-bright)" : isFinal ? "var(--text-dim)" : "var(--text-bright)" }}
            >
              {team.abbreviation || "TBD"}
            </span>
          </div>
          {!isScheduled && (
            <span
              className="stat-num text-[15px]"
              style={{ color: won ? "var(--text-bright)" : isFinal ? "var(--text-dim)" : "var(--text-bright)" }}
            >
              {score}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Section Header ─── */
function SectionHeader({ title, href, linkText }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[16px] font-bold" style={{ color: "var(--text-bright)" }}>{title}</h2>
      {href && (
        <Link href={href} className="text-[12px] font-semibold hover:underline" style={{ color: "var(--accent)" }}>
          {linkText || "See all"} →
        </Link>
      )}
    </div>
  );
}

/* ─── Leader Row ─── */
function LeaderRow({ stat, player, rank, statKey, statLabel }) {
  return (
    <Link
      href={`/nba/players/${player?.espn_id || stat.player_id?.replace("nba_", "")}`}
      className="flex items-center gap-3 px-3 py-2.5 card-hover"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <span
        className="stat-num text-[11px] w-5 text-center font-bold flex-shrink-0"
        style={{ color: rank <= 3 ? "var(--accent)" : "var(--text-dim)" }}
      >
        {rank}
      </span>
      {player?.headshot_url ? (
        <img src={player.headshot_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" style={{ background: "var(--bg-surface)" }} />
      ) : (
        <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ background: "var(--bg-surface)" }} />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold truncate" style={{ color: "var(--text-bright)" }}>
          {player?.name || "Unknown"}
        </div>
        <div className="text-[11px]" style={{ color: "var(--text-dim)" }}>
          {player?.position}{player?.team_id ? ` · ${player.team_id.replace("nba_", "").toUpperCase()}` : ""}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="stat-num text-[16px]" style={{ color: "var(--text-bright)" }}>{fmt(stat[statKey], 1)}</div>
        <div className="text-[10px] font-semibold" style={{ color: "var(--text-dim)" }}>{statLabel}</div>
      </div>
    </Link>
  );
}

/* ═══════════════ HOME PAGE ═══════════════ */
export default async function Home() {
  let data = {
    games: [], standings: [], scoringLeaders: [], assistLeaders: [], reboundLeaders: [], teamMap: {}, playerMap: {},
  };
  try {
    data = await getData();
  } catch (e) {
    console.error("Homepage data error:", e);
  }

  const { games, standings, scoringLeaders, assistLeaders, reboundLeaders, teamMap, playerMap } = data;

  const finishedOrLive = games.filter((g) => g.status === "final" || g.status === "in_progress");
  const scheduled = games.filter((g) => g.status === "scheduled");
  const displayGames = [...finishedOrLive, ...scheduled];

  const east = standings.filter((s) => teamMap[s.team_id]?.conference?.toLowerCase().includes("east"));
  const west = standings.filter((s) => teamMap[s.team_id]?.conference?.toLowerCase().includes("west"));

  const hasData = games.length > 0 || standings.length > 0 || scoringLeaders.length > 0;

  return (
    <div>
      {/* Hero */}
      <div className="mb-5">
        <h1 className="text-[24px] sm:text-[28px] font-extrabold tracking-tight" style={{ color: "var(--text-bright)" }}>
          Today in Sports
        </h1>
        <p className="text-[13px] sm:text-[14px] mt-0.5" style={{ color: "var(--text-dim)" }}>
          Scores, standings &amp; stats — all in one place.
        </p>
      </div>

      {!hasData && (
        <div className="text-center py-16 rounded-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-base mb-2" style={{ color: "var(--text-bright)" }}>No data yet</p>
          <p className="text-[13px]" style={{ color: "var(--text-dim)" }}>
            Run <code className="px-2 py-0.5 rounded-md text-[12px]" style={{ background: "var(--bg-surface)", color: "var(--accent)" }}>python sync_nba.py</code> to pull NBA data.
          </p>
        </div>
      )}

      {/* ── Scores ── */}
      {displayGames.length > 0 && (
        <section className="mb-8">
          <SectionHeader title="Scores" />
          {/* Mobile: horizontal scroll */}
          <div className="lg:hidden scroll-strip -mx-4 px-4">
            <div className="flex gap-2.5 pb-1" style={{ width: "max-content" }}>
              {displayGames.slice(0, 12).map((g) => (
                <ScoreCard key={g.id} game={g} teamMap={teamMap} />
              ))}
            </div>
          </div>
          {/* Desktop: wrap grid */}
          <div className="hidden lg:grid grid-cols-4 xl:grid-cols-5 gap-2.5">
            {displayGames.slice(0, 10).map((g) => (
              <ScoreCard key={g.id} game={g} teamMap={teamMap} />
            ))}
          </div>
        </section>
      )}

      {/* ── Standings ── */}
      {standings.length > 0 && (
        <section className="mb-8">
          <SectionHeader title="Standings" href="/nba/standings" linkText="Full standings" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { label: "Eastern Conference", data: east },
              { label: "Western Conference", data: west },
            ].map(({ label, data: conf }) => (
              <div
                key={label}
                className="rounded-2xl overflow-hidden"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2" style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border)" }}>
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>{label}</span>
                  <div className="flex">
                    <span className="text-[10px] font-semibold w-9 text-center" style={{ color: "var(--text-dim)" }}>W</span>
                    <span className="text-[10px] font-semibold w-9 text-center" style={{ color: "var(--text-dim)" }}>L</span>
                    <span className="text-[10px] font-semibold w-12 text-center" style={{ color: "var(--text-dim)" }}>PCT</span>
                    <span className="text-[10px] font-semibold w-10 text-center hidden sm:block" style={{ color: "var(--text-dim)" }}>GB</span>
                    <span className="text-[10px] font-semibold w-10 text-center hidden lg:block" style={{ color: "var(--text-dim)" }}>STRK</span>
                    <span className="text-[10px] font-semibold w-12 text-center hidden lg:block" style={{ color: "var(--text-dim)" }}>L10</span>
                  </div>
                </div>

                {/* Rows — show top 8 on homepage */}
                {conf.slice(0, 8).map((s, i) => {
                  const t = teamMap[s.team_id] || {};
                  const rank = s.conference_rank || i + 1;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center px-3 py-2"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <span
                        className="stat-num text-[11px] w-5 text-center font-bold flex-shrink-0"
                        style={{ color: rank <= 6 ? "var(--accent)" : rank <= 10 ? "var(--green)" : "var(--text-dim)" }}
                      >
                        {rank}
                      </span>
                      <div className="flex items-center gap-2 flex-1 min-w-0 ml-2">
                        {t.logo_url && <img src={t.logo_url} alt="" className="w-4 h-4 flex-shrink-0" />}
                        {/* Abbreviation on mobile, full name on tablet+ */}
                        <span className="text-[12px] font-semibold truncate sm:hidden" style={{ color: "var(--text-bright)" }}>
                          {t.abbreviation || "?"}
                        </span>
                        <span className="text-[12px] font-semibold truncate hidden sm:inline" style={{ color: "var(--text-bright)" }}>
                          {t.full_name || t.abbreviation || "?"}
                        </span>
                      </div>
                      <div className="flex flex-shrink-0">
                        <span className="stat-num text-[12px] w-9 text-center" style={{ color: "var(--text-bright)" }}>{s.wins}</span>
                        <span className="stat-num text-[12px] w-9 text-center" style={{ color: "var(--text-dim)" }}>{s.losses}</span>
                        <span
                          className="stat-num text-[12px] w-12 text-center font-semibold"
                          style={{ color: s.pct >= 0.6 ? "var(--green)" : s.pct < 0.4 ? "var(--red)" : "var(--text)" }}
                        >
                          {fmt(s.pct, 3)}
                        </span>
                        <span className="stat-num text-[11px] w-10 text-center hidden sm:block" style={{ color: "var(--text-dim)" }}>
                          {s.games_back != null ? (s.games_back === 0 ? "—" : s.games_back) : "-"}
                        </span>
                        <span
                          className="stat-num text-[11px] w-10 text-center hidden lg:block"
                          style={{ color: s.streak?.startsWith("W") ? "var(--green)" : s.streak?.startsWith("L") ? "var(--red)" : "var(--text-dim)" }}
                        >
                          {s.streak || "-"}
                        </span>
                        <span className="stat-num text-[11px] w-12 text-center hidden lg:block" style={{ color: "var(--text-dim)" }}>
                          {s.last_10 || "-"}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Playoff legend */}
                <div className="flex items-center gap-4 px-3 py-1.5" style={{ background: "rgba(255,255,255,0.01)" }}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
                    <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>Playoff</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--green)" }} />
                    <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>Play-In</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── League Leaders ── */}
      {scoringLeaders.length > 0 && (
        <section className="mb-8">
          <SectionHeader title="League Leaders" href="/nba/players" linkText="Full leaderboard" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {[
              { title: "Scoring", data: scoringLeaders, key: "points_per_game", label: "PPG" },
              { title: "Assists", data: assistLeaders, key: "assists_per_game", label: "APG" },
              { title: "Rebounds", data: reboundLeaders, key: "rebounds_per_game", label: "RPG" },
            ].map((cat) => (
              <div
                key={cat.title}
                className="rounded-2xl overflow-hidden"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <div className="px-3 py-2" style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border)" }}>
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>{cat.title}</span>
                </div>
                {cat.data.map((s, i) => (
                  <LeaderRow
                    key={s.id}
                    stat={s}
                    player={playerMap[s.player_id]}
                    rank={i + 1}
                    statKey={cat.key}
                    statLabel={cat.label}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Sport Quick Links ── */}
      <section>
        <div className="grid grid-cols-3 sm:grid-cols-3 gap-2.5">
          {[
            { sport: "NBA", icon: "🏀", href: "/nba", active: true },
            { sport: "NFL", icon: "🏈", href: "/nfl", active: false },
            { sport: "MLB", icon: "⚾", href: "/mlb", active: false },
          ].map((s) => (
            <Link
              key={s.sport}
              href={s.active ? s.href : "#"}
              className="rounded-2xl p-4 sm:p-5 text-center card-hover"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                opacity: s.active ? 1 : 0.35,
                pointerEvents: s.active ? "auto" : "none",
              }}
            >
              <div className="text-2xl sm:text-3xl mb-1">{s.icon}</div>
              <div className="text-[14px] font-bold" style={{ color: "var(--text-bright)" }}>{s.sport}</div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--text-dim)" }}>
                {s.active ? "Live" : "Coming soon"}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
