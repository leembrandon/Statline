import Link from "next/link";
import { query, supabase } from "@/lib/supabase";
import { fmt, formatTime, formatDate } from "@/lib/utils";

export const revalidate = 300;

async function getData() {
  // Pull everything — sport-agnostic. Only NBA has data now, but NFL/MLB will flow in later.
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

  // Gather unique IDs
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

  // Batch fetch teams and players
  let teams = [];
  if (allTeamIds.length > 0) {
    const { data } = await supabase
      .from("teams")
      .select("*")
      .in("id", allTeamIds);
    teams = data || [];
  }

  let players = [];
  if (allPlayerIds.length > 0) {
    const { data } = await supabase
      .from("players")
      .select("*")
      .in("id", allPlayerIds);
    players = data || [];
  }

  const teamMap = {};
  teams.forEach((t) => (teamMap[t.id] = t));
  const playerMap = {};
  players.forEach((p) => (playerMap[p.id] = p));

  return {
    games,
    standings,
    scoringLeaders,
    assistLeaders,
    reboundLeaders,
    teamMap,
    playerMap,
  };
}

/* ─── Score Card (inside horizontal strip) ─── */
function ScoreCard({ game, teamMap }) {
  const isFinal = game.status === "final";
  const isLive = game.status === "in_progress";
  const isScheduled = game.status === "scheduled";
  const homeTeam = teamMap[game.home_team_id] || {};
  const awayTeam = teamMap[game.away_team_id] || {};
  const homeWon = isFinal && game.home_score > game.away_score;
  const awayWon = isFinal && game.away_score > game.home_score;

  // Don't show cards with 0-0 scheduled games that look weird
  const showScores = !isScheduled;

  return (
    <div
      className="flex-shrink-0 w-[168px] rounded-2xl p-3 card-hover"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Status bar */}
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
            {formatTime(game.start_time)}
          </span>
        )}
        <span
          className="text-[10px] font-medium"
          style={{ color: "var(--text-dim)" }}
        >
          {formatDate(game.start_time)}
        </span>
      </div>

      {/* Away team */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {awayTeam.logo_url ? (
            <img
              src={awayTeam.logo_url}
              alt=""
              className="w-5 h-5 flex-shrink-0"
            />
          ) : (
            <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: "var(--bg-surface)" }} />
          )}
          <span
            className="text-[13px] font-bold truncate"
            style={{
              color: awayWon ? "var(--text-bright)" : isFinal ? "var(--text-dim)" : "var(--text-bright)",
            }}
          >
            {awayTeam.abbreviation || "TBD"}
          </span>
        </div>
        {showScores && (
          <span
            className="stat-num text-[15px]"
            style={{
              color: awayWon ? "var(--text-bright)" : isFinal ? "var(--text-dim)" : "var(--text-bright)",
            }}
          >
            {game.away_score}
          </span>
        )}
      </div>

      {/* Home team */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {homeTeam.logo_url ? (
            <img
              src={homeTeam.logo_url}
              alt=""
              className="w-5 h-5 flex-shrink-0"
            />
          ) : (
            <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: "var(--bg-surface)" }} />
          )}
          <span
            className="text-[13px] font-bold truncate"
            style={{
              color: homeWon ? "var(--text-bright)" : isFinal ? "var(--text-dim)" : "var(--text-bright)",
            }}
          >
            {homeTeam.abbreviation || "TBD"}
          </span>
        </div>
        {showScores && (
          <span
            className="stat-num text-[15px]"
            style={{
              color: homeWon ? "var(--text-bright)" : isFinal ? "var(--text-dim)" : "var(--text-bright)",
            }}
          >
            {game.home_score}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Section Header ─── */
function SectionHeader({ title, href, linkText }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[15px] font-bold" style={{ color: "var(--text-bright)" }}>
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="text-[12px] font-semibold"
          style={{ color: "var(--accent)" }}
        >
          {linkText || "See all"} →
        </Link>
      )}
    </div>
  );
}

/* ─── Compact Standings Row ─── */
function StandingsRow({ standing, team, rank }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <span
        className="stat-num text-[11px] w-5 text-center font-bold"
        style={{
          color:
            rank <= 6 ? "var(--accent)" : rank <= 10 ? "var(--green)" : "var(--text-dim)",
        }}
      >
        {rank}
      </span>
      {team.logo_url && (
        <img src={team.logo_url} alt="" className="w-4 h-4 flex-shrink-0" />
      )}
      <span
        className="text-[12px] font-semibold flex-1 truncate"
        style={{ color: "var(--text-bright)" }}
      >
        {team.abbreviation || "?"}
      </span>
      <span className="stat-num text-[12px] w-8 text-center" style={{ color: "var(--text-bright)" }}>
        {standing.wins}
      </span>
      <span className="stat-num text-[12px] w-8 text-center" style={{ color: "var(--text-dim)" }}>
        {standing.losses}
      </span>
      <span
        className="stat-num text-[12px] w-10 text-right"
        style={{
          color:
            standing.pct >= 0.6
              ? "var(--green)"
              : standing.pct < 0.4
                ? "var(--red)"
                : "var(--text)",
        }}
      >
        {fmt(standing.pct, 3)}
      </span>
    </div>
  );
}

/* ─── Leader Card (mobile-friendly) ─── */
function LeaderCard({ stat, player, rank, statKey, statLabel }) {
  const team = player?.team_id?.replace("nba_", "") || "";

  return (
    <Link
      href={`/nba/players/${player?.espn_id || stat.player_id?.replace("nba_", "")}`}
      className="flex items-center gap-3 px-3 py-2.5 card-hover"
      style={{
        borderBottom: "1px solid var(--border)",
        background: "transparent",
      }}
    >
      <span
        className="stat-num text-[11px] w-5 text-center font-bold"
        style={{
          color: rank <= 3 ? "var(--accent)" : "var(--text-dim)",
        }}
      >
        {rank}
      </span>
      {player?.headshot_url ? (
        <img
          src={player.headshot_url}
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
          {player?.name || "Unknown"}
        </div>
        <div className="text-[11px]" style={{ color: "var(--text-dim)" }}>
          {player?.position}
          {team ? ` · ${team.toUpperCase()}` : ""}
        </div>
      </div>
      <div className="text-right">
        <div
          className="stat-num text-[16px]"
          style={{ color: "var(--text-bright)" }}
        >
          {fmt(stat[statKey], 1)}
        </div>
        <div className="text-[10px] font-semibold" style={{ color: "var(--text-dim)" }}>
          {statLabel}
        </div>
      </div>
    </Link>
  );
}

/* ═══════════════════════════════════════════════ */
/*                   HOME PAGE                     */
/* ═══════════════════════════════════════════════ */

export default async function Home() {
  let data = {
    games: [],
    standings: [],
    scoringLeaders: [],
    assistLeaders: [],
    reboundLeaders: [],
    teamMap: {},
    playerMap: {},
  };

  try {
    data = await getData();
  } catch (e) {
    console.error("Homepage data error:", e);
  }

  const {
    games,
    standings,
    scoringLeaders,
    assistLeaders,
    reboundLeaders,
    teamMap,
    playerMap,
  } = data;

  // Split games: final/live first, then scheduled
  const finishedOrLive = games.filter(
    (g) => g.status === "final" || g.status === "in_progress"
  );
  const scheduled = games.filter((g) => g.status === "scheduled");
  const displayGames = [...finishedOrLive, ...scheduled];

  // Split standings by conference
  const east = standings
    .filter((s) => {
      const t = teamMap[s.team_id];
      return t?.conference?.toLowerCase().includes("east");
    })
    .slice(0, 8);
  const west = standings
    .filter((s) => {
      const t = teamMap[s.team_id];
      return t?.conference?.toLowerCase().includes("west");
    })
    .slice(0, 8);

  const hasData =
    games.length > 0 || standings.length > 0 || scoringLeaders.length > 0;

  return (
    <div>
      {/* ── Hero ── */}
      <div className="mb-5">
        <h1
          className="text-[22px] font-extrabold tracking-tight"
          style={{ color: "var(--text-bright)" }}
        >
          Today in Sports
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: "var(--text-dim)" }}>
          Scores, standings &amp; stats — all in one place.
        </p>
      </div>

      {!hasData && (
        <div
          className="text-center py-16 rounded-2xl"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <p
            className="text-base mb-2"
            style={{ color: "var(--text-bright)" }}
          >
            No data yet
          </p>
          <p className="text-[13px]" style={{ color: "var(--text-dim)" }}>
            Run{" "}
            <code
              className="px-2 py-0.5 rounded-md text-[12px]"
              style={{ background: "var(--bg-surface)", color: "var(--accent)" }}
            >
              python sync_nba.py
            </code>{" "}
            to pull NBA data.
          </p>
        </div>
      )}

      {/* ── Scores Strip ── */}
      {displayGames.length > 0 && (
        <section className="mb-7">
          <SectionHeader title="Scores" />
          <div className="scroll-strip -mx-4 px-4">
            <div className="flex gap-2.5 pb-1" style={{ width: "max-content" }}>
              {displayGames.slice(0, 12).map((g) => (
                <ScoreCard key={g.id} game={g} teamMap={teamMap} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Standings Snapshot ── */}
      {standings.length > 0 && (
        <section className="mb-7">
          <SectionHeader
            title="Standings"
            href="/nba/standings"
            linkText="Full standings"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "East", data: east },
              { label: "West", data: west },
            ].map(({ label, data: conf }) => (
              <div
                key={label}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                }}
              >
                {/* Conference header */}
                <div
                  className="flex items-center justify-between px-3 py-2"
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
                  <div className="flex gap-3">
                    <span className="text-[10px] font-semibold w-8 text-center" style={{ color: "var(--text-dim)" }}>
                      W
                    </span>
                    <span className="text-[10px] font-semibold w-8 text-center" style={{ color: "var(--text-dim)" }}>
                      L
                    </span>
                    <span className="text-[10px] font-semibold w-10 text-right" style={{ color: "var(--text-dim)" }}>
                      PCT
                    </span>
                  </div>
                </div>

                {conf.map((s, i) => {
                  const t = teamMap[s.team_id] || {};
                  return (
                    <StandingsRow
                      key={s.id}
                      standing={s}
                      team={t}
                      rank={s.conference_rank || i + 1}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Stat Leaders ── */}
      {scoringLeaders.length > 0 && (
        <section className="mb-7">
          <SectionHeader
            title="League Leaders"
            href="/nba/players"
            linkText="Full leaderboard"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                title: "Points",
                data: scoringLeaders,
                key: "points_per_game",
                label: "PPG",
              },
              {
                title: "Assists",
                data: assistLeaders,
                key: "assists_per_game",
                label: "APG",
              },
              {
                title: "Rebounds",
                data: reboundLeaders,
                key: "rebounds_per_game",
                label: "RPG",
              },
            ].map((cat) => (
              <div
                key={cat.title}
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
                    {cat.title}
                  </span>
                </div>

                {cat.data.map((s, i) => (
                  <LeaderCard
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
      <section className="mb-4">
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { sport: "NBA", icon: "🏀", href: "/nba", active: true },
            { sport: "NFL", icon: "🏈", href: "/nfl", active: false },
            { sport: "MLB", icon: "⚾", href: "/mlb", active: false },
          ].map((s) => (
            <Link
              key={s.sport}
              href={s.active ? s.href : "#"}
              className="rounded-2xl p-4 text-center card-hover"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                opacity: s.active ? 1 : 0.35,
                pointerEvents: s.active ? "auto" : "none",
              }}
            >
              <div className="text-2xl mb-1">{s.icon}</div>
              <div
                className="text-[13px] font-bold"
                style={{ color: "var(--text-bright)" }}
              >
                {s.sport}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: "var(--text-dim)" }}>
                {s.active ? "Live" : "Coming soon"}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
