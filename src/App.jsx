import { useState, useEffect, useMemo, useCallback, useRef } from "react";

/* ─── CONFIG ─── */
const SUPABASE_URL = "https://snucfaofcihjazipvird.supabase.co/rest/v1";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNudWNmYW9mY2loamF6aXB2aXJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2ODYzODEsImV4cCI6MjA4OTI2MjM4MX0.nEjx1Lx4i2oruPajbrKwILX5AK1PBfmMqx5PaCL--nQ";

async function supaFetch(table, queryStr) {
  const url = `${SUPABASE_URL}/${table}?${queryStr || "select=*"}`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Fetch ${table} failed (${res.status})`);
  return res.json();
}

/* ─── SPORT TABS ─── */
const SPORTS = [
  { id: "nba", label: "NBA", icon: "🏀", color: "#e94560", active: true },
  { id: "nfl", label: "NFL", icon: "🏈", color: "#4a90d9", active: false },
  { id: "mlb", label: "MLB", icon: "⚾", color: "#52b788", active: false },
];

const TABS = ["Scores", "Standings", "Players", "Compare", "Search"];

/* ─── HELPERS ─── */
function fmt(val, dec = 1) {
  if (val == null || val === "") return "—";
  return Number(val).toFixed(dec);
}

function pctColor(val) {
  if (val >= 0.6) return "#52b788";
  if (val < 0.4) return "#ff6b6b";
  return "#c8c8d0";
}

function streakColor(s) {
  if (!s) return "#666";
  if (s.startsWith("W")) return "#52b788";
  if (s.startsWith("L")) return "#ff6b6b";
  return "#666";
}

function formatGameTime(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    });
  } catch {
    return "";
  }
}

function formatGameDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "America/New_York",
    });
  } catch {
    return "";
  }
}

/* ─── DATA LAYER ─── */
async function fetchAllNBAData() {
  const [games, standings, playerStats, players, teams] = await Promise.all([
    supaFetch("games", "select=*&sport=eq.nba&order=start_time.desc&limit=30"),
    supaFetch("standings", "select=*&sport=eq.nba&order=conference_rank.asc"),
    supaFetch("nba_player_stats", "select=*&order=points_per_game.desc&limit=150"),
    supaFetch("players", "select=*&sport=eq.nba"),
    supaFetch("teams", "select=*&sport=eq.nba"),
  ]);

  const teamMap = {};
  teams.forEach((t) => (teamMap[t.id] = t));
  const playerMap = {};
  players.forEach((p) => (playerMap[p.id] = p));

  // Enrich stats with player info
  const enrichedStats = playerStats.map((s) => {
    const p = playerMap[s.player_id] || {};
    return { ...s, name: p.name, position: p.position, team_id: p.team_id, headshot_url: p.headshot_url, espn_id: p.espn_id, jersey_number: p.jersey_number, height: p.height, weight: p.weight, age: p.age };
  });

  // Split standings by conference
  const east = standings.filter((s) => {
    const t = teamMap[s.team_id];
    return t && t.conference && t.conference.toLowerCase().includes("east");
  });
  const west = standings.filter((s) => {
    const t = teamMap[s.team_id];
    return t && t.conference && t.conference.toLowerCase().includes("west");
  });

  return { games, standings, east, west, playerStats: enrichedStats, playerMap, teamMap };
}

/* ─── COMPONENTS ─── */

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#08080f" }}>
      <div className="text-center space-y-4">
        <div className="relative w-12 h-12 mx-auto">
          <div className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#e94560", borderTopColor: "transparent" }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "#e94560" }}>STATLINE</p>
          <p className="text-xs mt-1" style={{ color: "#555" }}>Loading stats...</p>
        </div>
      </div>
    </div>
  );
}

function ErrorScreen({ error, onRetry }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#08080f" }}>
      <div className="text-center p-6 rounded-2xl max-w-sm mx-4" style={{ background: "rgba(233,69,96,0.08)", border: "1px solid rgba(233,69,96,0.2)" }}>
        <p className="text-lg font-bold mb-2" style={{ color: "#e94560" }}>Connection error</p>
        <p className="text-sm mb-4" style={{ color: "#888" }}>{error}</p>
        <button onClick={onRetry} className="px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: "#e94560", color: "#fff" }}>
          Try again
        </button>
      </div>
    </div>
  );
}

function EmptyState({ message, sub }) {
  return (
    <div className="text-center py-16">
      <p className="text-base font-semibold" style={{ color: "#555" }}>{message}</p>
      {sub && <p className="text-xs mt-2" style={{ color: "#444" }}>{sub}</p>}
    </div>
  );
}

/* ── Score Card ── */
function ScoreCard({ game, teamMap }) {
  const isFinal = game.status === "final";
  const isLive = game.status === "in_progress";
  const home = teamMap[game.home_team_id] || {};
  const away = teamMap[game.away_team_id] || {};
  const homeWon = isFinal && game.home_score > game.away_score;
  const awayWon = isFinal && game.away_score > game.home_score;

  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: "10px", color: "#555", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {isFinal ? "Final" : isLive ? game.status_detail || "Live" : formatGameTime(game.start_time)}
        </span>
        {isLive && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#ff3b30" }} />
            <span style={{ fontSize: "10px", fontWeight: 700, color: "#ff3b30" }}>LIVE</span>
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {[{ team: away, score: game.away_score, won: awayWon, lost: isFinal && !awayWon }, { team: home, score: game.home_score, won: homeWon, lost: isFinal && !homeWon }].map((row, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {row.team.logo_url && <img src={row.team.logo_url} alt="" className="w-5 h-5 flex-shrink-0" style={{ opacity: row.lost ? 0.4 : 1 }} />}
              <span className="text-sm font-semibold truncate" style={{ color: row.won ? "#fff" : row.lost ? "#555" : "#c8c8d0" }}>
                {row.team.abbreviation || "???"}
              </span>
            </div>
            <span className="text-base font-bold tabular-nums" style={{ color: row.won ? "#fff" : row.lost ? "#555" : "#c8c8d0" }}>
              {row.score != null ? row.score : "—"}
            </span>
          </div>
        ))}
      </div>
      {!isFinal && !isLive && (
        <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <span style={{ fontSize: "10px", color: "#444" }}>{formatGameDate(game.start_time)}</span>
        </div>
      )}
    </div>
  );
}

/* ── Scores Tab ── */
function ScoresView({ games, teamMap }) {
  if (!games.length) return <EmptyState message="No games yet" sub="Run the NBA sync script to pull game data" />;

  // Group games by date
  const grouped = {};
  games.forEach((g) => {
    const dateKey = formatGameDate(g.start_time) || "Unknown";
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(g);
  });

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, dateGames]) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded" style={{ background: "#e94560" }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#888" }}>{date}</span>
            <span className="text-xs" style={{ color: "#444" }}>· {dateGames.length} games</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {dateGames.map((g) => (
              <ScoreCard key={g.id} game={g} teamMap={teamMap} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Standings Tab ── */
function StandingsTable({ label, standings, teamMap }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="px-3 py-2.5" style={{ background: "rgba(233,69,96,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#e94560" }}>{label}</span>
      </div>
      {/* Header */}
      <div className="px-3 py-1.5 grid items-center" style={{ gridTemplateColumns: "22px 1fr 36px 36px 48px 48px 48px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: "10px", color: "#555", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        <span>#</span><span>Team</span><span className="text-center">W</span><span className="text-center">L</span><span className="text-center">PCT</span>
        <span className="text-center hidden sm:block">STRK</span><span className="text-center hidden sm:block">HOME</span>
      </div>
      {/* Rows */}
      {standings.map((s, i) => {
        const t = teamMap[s.team_id] || {};
        const rank = s.conference_rank || i + 1;
        const isPlayIn = rank > 6 && rank <= 10;
        return (
          <div key={s.id} className="px-3 py-2 grid items-center" style={{
            gridTemplateColumns: "22px 1fr 36px 36px 48px 48px 48px",
            borderBottom: "1px solid rgba(255,255,255,0.03)",
            background: i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent"
          }}>
            <span className="text-xs font-bold" style={{ color: rank <= 6 ? "#e94560" : isPlayIn ? "#ffd166" : "#444" }}>{rank}</span>
            <div className="flex items-center gap-2 min-w-0">
              {t.logo_url && <img src={t.logo_url} alt="" className="w-4 h-4 flex-shrink-0" />}
              <span className="text-sm font-semibold text-white truncate">{t.abbreviation || "?"}</span>
              <span className="text-xs hidden sm:inline truncate" style={{ color: "#555" }}>{t.name}</span>
            </div>
            <span className="text-xs text-center font-semibold">{s.wins}</span>
            <span className="text-xs text-center" style={{ color: "#888" }}>{s.losses}</span>
            <span className="text-xs text-center font-semibold" style={{ color: pctColor(s.pct) }}>{fmt(s.pct, 3)}</span>
            <span className="text-xs text-center hidden sm:block" style={{ color: streakColor(s.streak) }}>{s.streak || "—"}</span>
            <span className="text-xs text-center hidden sm:block" style={{ color: "#888" }}>{s.home_record || "—"}</span>
          </div>
        );
      })}
      {standings.length === 0 && <div className="p-4 text-center text-xs" style={{ color: "#555" }}>No standings data</div>}
    </div>
  );
}

function StandingsView({ east, west, teamMap }) {
  if (!east.length && !west.length) return <EmptyState message="No standings data" sub="Run the sync script to populate standings" />;
  return (
    <div className="space-y-4">
      <StandingsTable label="Eastern Conference" standings={east} teamMap={teamMap} />
      <StandingsTable label="Western Conference" standings={west} teamMap={teamMap} />
      <div className="flex items-center gap-4 mt-2" style={{ fontSize: "10px", color: "#555" }}>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: "#e94560" }} /> Playoff</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: "#ffd166" }} /> Play-in</span>
      </div>
    </div>
  );
}

/* ── Players Tab ── */
function PlayersView({ playerStats, teamMap, onSelectPlayer }) {
  const [sortBy, setSortBy] = useState("points_per_game");
  const sortOptions = [
    { key: "points_per_game", label: "PTS" },
    { key: "rebounds_per_game", label: "REB" },
    { key: "assists_per_game", label: "AST" },
    { key: "steals_per_game", label: "STL" },
    { key: "blocks_per_game", label: "BLK" },
    { key: "fg_pct", label: "FG%" },
    { key: "fg3_pct", label: "3P%" },
  ];

  const sorted = useMemo(() => {
    return [...playerStats].sort((a, b) => (Number(b[sortBy]) || 0) - (Number(a[sortBy]) || 0));
  }, [playerStats, sortBy]);

  const sortLabel = sortOptions.find((o) => o.key === sortBy)?.label || "";
  const isFGStat = sortBy.includes("pct");

  if (!playerStats.length) return <EmptyState message="No player data" sub="Run the sync script to pull player stats" />;

  return (
    <div>
      {/* Sort pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {sortOptions.map((opt) => (
          <button key={opt.key} onClick={() => setSortBy(opt.key)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all" style={{
            background: sortBy === opt.key ? "rgba(233,69,96,0.15)" : "rgba(255,255,255,0.04)",
            color: sortBy === opt.key ? "#e94560" : "#666",
            border: sortBy === opt.key ? "1px solid rgba(233,69,96,0.3)" : "1px solid transparent",
          }}>
            {opt.label}
          </button>
        ))}
      </div>
      <div className="text-xs mb-3" style={{ color: "#555" }}>{sorted.length} players · Sorted by {sortLabel}</div>

      {/* Player list */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        {sorted.map((s, i) => {
          const team = teamMap[s.team_id] || {};
          const mainVal = Number(s[sortBy]) || 0;
          return (
            <div key={s.id || i} className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer" style={{
              borderBottom: "1px solid rgba(255,255,255,0.03)",
              background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
            }} onClick={() => onSelectPlayer && onSelectPlayer(s)}>
              <span className="text-xs font-bold flex-shrink-0" style={{ width: "22px", textAlign: "center", color: i < 3 ? "#e94560" : i < 10 ? "#ffd166" : "#444" }}>{i + 1}</span>
              {s.headshot_url && <img src={s.headshot_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-white truncate">{s.name || "Unknown"}</span>
                  {s.position && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "#888", fontSize: "10px" }}>{s.position}</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {team.logo_url && <img src={team.logo_url} alt="" className="w-3 h-3" />}
                  <span style={{ fontSize: "11px", color: "#555" }}>{team.abbreviation || ""}</span>
                  <span style={{ fontSize: "10px", color: "#444" }}>{s.games_played} GP</span>
                </div>
              </div>
              {/* Context stats — hidden on small mobile */}
              <div className="text-center hidden sm:block" style={{ minWidth: "40px" }}>
                <div style={{ fontSize: "9px", color: "#555" }}>PTS</div>
                <div className="text-xs font-semibold" style={{ color: "#aaa" }}>{fmt(s.points_per_game)}</div>
              </div>
              <div className="text-center hidden sm:block" style={{ minWidth: "40px" }}>
                <div style={{ fontSize: "9px", color: "#555" }}>REB</div>
                <div className="text-xs font-semibold" style={{ color: "#aaa" }}>{fmt(s.rebounds_per_game)}</div>
              </div>
              <div className="text-center hidden sm:block" style={{ minWidth: "40px" }}>
                <div style={{ fontSize: "9px", color: "#555" }}>AST</div>
                <div className="text-xs font-semibold" style={{ color: "#aaa" }}>{fmt(s.assists_per_game)}</div>
              </div>
              {/* Main stat */}
              <div className="text-center flex-shrink-0" style={{ minWidth: "48px" }}>
                <div style={{ fontSize: "9px", color: "#555" }}>{sortLabel}</div>
                <div className="text-base font-bold" style={{ color: i < 3 ? "#e94560" : "#fff" }}>
                  {isFGStat ? fmt(mainVal, 1) : fmt(mainVal, 1)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Player Detail (inline view) ── */
function PlayerDetail({ player, teamMap, onBack }) {
  const team = teamMap[player.team_id] || {};

  function StatBox({ label, value, highlight, wide }) {
    return (
      <div className={`text-center p-2.5 rounded-lg ${wide ? "col-span-2" : ""}`} style={{ background: "rgba(255,255,255,0.03)" }}>
        <div style={{ fontSize: "9px", color: "#555", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>{label}</div>
        <div className="font-bold" style={{ fontSize: highlight ? "20px" : "15px", color: highlight ? "#fff" : "#c8c8d0" }}>{value}</div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={onBack} className="text-xs font-semibold mb-4 flex items-center gap-1" style={{ color: "#e94560" }}>
        ← Back to players
      </button>
      {/* Hero */}
      <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-4">
          {player.headshot_url && <img src={player.headshot_url} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-black text-white truncate">{player.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {team.logo_url && <img src={team.logo_url} alt="" className="w-4 h-4" />}
              <span className="text-sm" style={{ color: "#888" }}>{team.full_name || team.name}</span>
              {player.position && <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.08)", color: "#888" }}>{player.position}</span>}
              {player.jersey_number && <span className="text-sm" style={{ color: "#555" }}>#{player.jersey_number}</span>}
            </div>
            <div className="flex gap-3 mt-1.5 text-xs" style={{ color: "#555" }}>
              {player.height && <span>{player.height}</span>}
              {player.weight && <span>{player.weight}</span>}
              {player.age && <span>{player.age} yrs</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Season averages */}
      <div className="mb-4">
        <div className="text-xs uppercase tracking-wider font-bold mb-2" style={{ color: "#e94560" }}>Season averages</div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          <StatBox label="PTS" value={fmt(player.points_per_game)} highlight />
          <StatBox label="REB" value={fmt(player.rebounds_per_game)} highlight />
          <StatBox label="AST" value={fmt(player.assists_per_game)} highlight />
          <StatBox label="STL" value={fmt(player.steals_per_game)} />
          <StatBox label="BLK" value={fmt(player.blocks_per_game)} />
          <StatBox label="TO" value={fmt(player.turnovers_per_game)} />
        </div>
      </div>

      {/* Shooting */}
      <div>
        <div className="text-xs uppercase tracking-wider font-bold mb-2" style={{ color: "#e94560" }}>Shooting</div>
        <div className="grid grid-cols-4 gap-1.5">
          <StatBox label="FG%" value={fmt(player.fg_pct)} />
          <StatBox label="3P%" value={fmt(player.fg3_pct)} />
          <StatBox label="FT%" value={fmt(player.ft_pct)} />
          <StatBox label="MIN" value={fmt(player.minutes_per_game)} />
        </div>
      </div>

      <div className="mt-4 text-xs" style={{ color: "#555" }}>{player.games_played} games played</div>
    </div>
  );
}

/* ── Compare Tab ── */
function CompareRow({ label, v1, v2, fmtStr = "0.1", higherBetter = true }) {
  const f = (v) => Number(v || 0).toFixed(fmtStr === "0.0" ? 0 : fmtStr === "0.1" ? 1 : 2);
  const n1 = Number(v1 || 0), n2 = Number(v2 || 0);
  const c1 = higherBetter ? (n1 > n2 ? "#52b788" : n1 < n2 ? "#ff6b6b" : "#ffd166") : (n1 < n2 ? "#52b788" : n1 > n2 ? "#ff6b6b" : "#ffd166");
  const c2 = higherBetter ? (n2 > n1 ? "#52b788" : n2 < n1 ? "#ff6b6b" : "#ffd166") : (n2 < n1 ? "#52b788" : n2 > n1 ? "#ff6b6b" : "#ffd166");

  return (
    <div className="grid items-center py-2" style={{ gridTemplateColumns: "1fr auto 1fr", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
      <div className="text-right pr-3"><span className="text-sm font-bold tabular-nums" style={{ color: c1 }}>{f(n1)}</span></div>
      <div className="text-center px-2" style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#555", minWidth: "56px" }}>{label}</div>
      <div className="text-left pl-3"><span className="text-sm font-bold tabular-nums" style={{ color: c2 }}>{f(n2)}</span></div>
    </div>
  );
}

function CompareView({ playerStats, teamMap }) {
  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");
  const [p1, setP1] = useState(null);
  const [p2, setP2] = useState(null);
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const cardRef = useRef(null);
  const [sharing, setSharing] = useState(false);

  const search = (q) => {
    if (q.length < 2) return [];
    const lower = q.toLowerCase();
    return playerStats.filter((p) => p.name && p.name.toLowerCase().includes(lower)).slice(0, 6);
  };

  const r1 = useMemo(() => search(q1), [q1, playerStats]);
  const r2 = useMemo(() => search(q2), [q2, playerStats]);

  const pick = (setter, qSetter, showSetter) => (p) => {
    setter(p);
    qSetter(p.name);
    showSetter(false);
  };

  const handleItem = (e, pickFn, p) => { e.preventDefault(); e.stopPropagation(); pickFn(p); };

  const stats = [
    { label: "PPG", k: "points_per_game" },
    { label: "RPG", k: "rebounds_per_game" },
    { label: "APG", k: "assists_per_game" },
    { label: "SPG", k: "steals_per_game" },
    { label: "BPG", k: "blocks_per_game" },
    { label: "TO", k: "turnovers_per_game", higherBetter: false },
    { label: "FG%", k: "fg_pct" },
    { label: "3P%", k: "fg3_pct" },
    { label: "FT%", k: "ft_pct" },
    { label: "MIN", k: "minutes_per_game" },
  ];

  let p1Wins = 0, p2Wins = 0;
  if (p1 && p2) {
    stats.forEach((st) => {
      const v1 = Number(p1[st.k] || 0), v2 = Number(p2[st.k] || 0);
      const hb = st.higherBetter !== false;
      if (hb ? v1 > v2 : v1 < v2) p1Wins++;
      else if (hb ? v2 > v1 : v2 < v1) p2Wins++;
    });
  }

  const handleShareImage = () => {
    if (!cardRef.current || sharing) return;
    setSharing(true);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    script.onload = () => {
      window.html2canvas(cardRef.current, { backgroundColor: "#08080f", scale: 2, useCORS: true }).then((canvas) => {
        canvas.toBlob((blob) => {
          if (!blob) { setSharing(false); return; }
          const file = new File([blob], "statline-compare.png", { type: "image/png" });
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: `${p1?.name} vs ${p2?.name} — StatLine` }).catch(() => {}).finally(() => setSharing(false));
          } else {
            const link = document.createElement("a");
            link.download = `statline-${p1?.name}-vs-${p2?.name}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
            setSharing(false);
          }
        }, "image/png");
      }).catch(() => setSharing(false));
    };
    script.onerror = () => setSharing(false);
    document.head.appendChild(script);
  };

  return (
    <div className="space-y-4">
      {/* Search inputs */}
      <div className="flex gap-2 items-start">
        <div className="relative flex-1">
          <input type="text" value={q1} onChange={(e) => { setQ1(e.target.value); setP1(null); setShow1(true); }} onFocus={() => setShow1(true)} onBlur={() => setTimeout(() => setShow1(false), 250)} placeholder="Player 1..." className="w-full p-2.5 rounded-xl text-white placeholder-gray-600 outline-none text-sm" style={{ background: "rgba(255,255,255,0.05)", border: p1 ? "1px solid rgba(82,183,136,0.4)" : "1px solid rgba(255,255,255,0.08)" }} />
          {show1 && r1.length > 0 && !p1 && (
            <div className="absolute z-20 w-full mt-1 rounded-xl overflow-hidden" style={{ background: "#14141e", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 12px 32px rgba(0,0,0,0.6)" }}>
              {r1.map((p) => (
                <div key={p.player_id || p.id} className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-white/5" onMouseDown={(e) => handleItem(e, pick(setP1, setQ1, setShow1), p)} onTouchEnd={(e) => handleItem(e, pick(setP1, setQ1, setShow1), p)}>
                  {p.headshot_url && <img src={p.headshot_url} alt="" className="w-6 h-6 rounded-full" />}
                  <span className="text-sm text-white font-medium">{p.name}</span>
                  <span className="text-xs ml-auto" style={{ color: "#555" }}>{(teamMap[p.team_id] || {}).abbreviation}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <span className="text-xs font-black pt-2.5" style={{ color: "#e94560" }}>VS</span>
        <div className="relative flex-1">
          <input type="text" value={q2} onChange={(e) => { setQ2(e.target.value); setP2(null); setShow2(true); }} onFocus={() => setShow2(true)} onBlur={() => setTimeout(() => setShow2(false), 250)} placeholder="Player 2..." className="w-full p-2.5 rounded-xl text-white placeholder-gray-600 outline-none text-sm" style={{ background: "rgba(255,255,255,0.05)", border: p2 ? "1px solid rgba(82,183,136,0.4)" : "1px solid rgba(255,255,255,0.08)" }} />
          {show2 && r2.length > 0 && !p2 && (
            <div className="absolute z-20 w-full mt-1 rounded-xl overflow-hidden" style={{ background: "#14141e", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 12px 32px rgba(0,0,0,0.6)" }}>
              {r2.map((p) => (
                <div key={p.player_id || p.id} className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-white/5" onMouseDown={(e) => handleItem(e, pick(setP2, setQ2, setShow2), p)} onTouchEnd={(e) => handleItem(e, pick(setP2, setQ2, setShow2), p)}>
                  {p.headshot_url && <img src={p.headshot_url} alt="" className="w-6 h-6 rounded-full" />}
                  <span className="text-sm text-white font-medium">{p.name}</span>
                  <span className="text-xs ml-auto" style={{ color: "#555" }}>{(teamMap[p.team_id] || {}).abbreviation}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Comparison card */}
      {p1 && p2 && (
        <div ref={cardRef} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {/* Headers */}
          <div className="grid items-center mb-4" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
            <div className="text-right pr-3">
              <div className="flex items-center justify-end gap-2">
                {p1.headshot_url && <img src={p1.headshot_url} alt="" className="w-10 h-10 rounded-full" />}
                <div className="text-right">
                  <div className="text-sm font-bold text-white">{p1.name}</div>
                  <div style={{ fontSize: "10px", color: "#555" }}>{(teamMap[p1.team_id] || {}).abbreviation} · {p1.position}</div>
                </div>
              </div>
              <div className="text-2xl font-black mt-1" style={{ color: p1Wins > p2Wins ? "#52b788" : p1Wins < p2Wins ? "#ff6b6b" : "#ffd166" }}>{p1Wins}</div>
            </div>
            <div className="text-center px-3">
              <div className="text-xs font-black" style={{ color: "#e94560" }}>VS</div>
              <div style={{ fontSize: "9px", color: "#555", marginTop: "2px" }}>{stats.length} cats</div>
            </div>
            <div className="text-left pl-3">
              <div className="flex items-center gap-2">
                <div>
                  <div className="text-sm font-bold text-white">{p2.name}</div>
                  <div style={{ fontSize: "10px", color: "#555" }}>{(teamMap[p2.team_id] || {}).abbreviation} · {p2.position}</div>
                </div>
                {p2.headshot_url && <img src={p2.headshot_url} alt="" className="w-10 h-10 rounded-full" />}
              </div>
              <div className="text-2xl font-black mt-1" style={{ color: p2Wins > p1Wins ? "#52b788" : p2Wins < p1Wins ? "#ff6b6b" : "#ffd166" }}>{p2Wins}</div>
            </div>
          </div>

          {/* Stat rows */}
          {stats.map((st) => (
            <CompareRow key={st.k} label={st.label} v1={p1[st.k]} v2={p2[st.k]} higherBetter={st.higherBetter !== false} />
          ))}

          {/* Share button */}
          <div className="flex justify-center gap-2 mt-4">
            <button onClick={handleShareImage} disabled={sharing} className="px-4 py-2 rounded-xl text-xs font-bold transition-all" style={{ background: sharing ? "rgba(233,69,96,0.2)" : "#e94560", color: "#fff", opacity: sharing ? 0.6 : 1 }}>
              {sharing ? "Generating..." : "📤 Share Card"}
            </button>
          </div>
        </div>
      )}

      {!p1 && !p2 && (
        <div className="text-center py-8">
          <p className="text-sm" style={{ color: "#555" }}>Search for two players to compare their stats head-to-head</p>
        </div>
      )}
    </div>
  );
}

/* ── Search Tab ── */
function SearchView({ playerStats, teamMap, onSelectPlayer }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    return playerStats.filter((p) => {
      const nameMatch = p.name && p.name.toLowerCase().includes(q);
      const team = teamMap[p.team_id] || {};
      const teamMatch = team.name && team.name.toLowerCase().includes(q);
      const abbrMatch = team.abbreviation && team.abbreviation.toLowerCase().includes(q);
      return nameMatch || teamMatch || abbrMatch;
    }).slice(0, 20);
  }, [query, playerStats, teamMap]);

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search player or team..."
        className="w-full p-3 rounded-xl text-white placeholder-gray-600 outline-none"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", fontSize: "16px" }}
      />
      {query.length >= 2 && results.length === 0 && (
        <p className="text-sm text-center py-4" style={{ color: "#555" }}>No results for "{query}"</p>
      )}
      {results.map((s, i) => {
        const team = teamMap[s.team_id] || {};
        return (
          <div key={s.id || i} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-colors" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }} onClick={() => onSelectPlayer(s)}>
            {s.headshot_url && <img src={s.headshot_url} alt="" className="w-10 h-10 rounded-full object-cover" />}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate">{s.name}</div>
              <div className="flex items-center gap-2 mt-0.5">
                {team.logo_url && <img src={team.logo_url} alt="" className="w-3 h-3" />}
                <span style={{ fontSize: "11px", color: "#555" }}>{team.full_name} · {s.position}</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-base font-bold text-white">{fmt(s.points_per_game)}</div>
              <div style={{ fontSize: "10px", color: "#555" }}>PPG</div>
            </div>
            <div className="text-right flex-shrink-0 hidden sm:block">
              <div className="text-sm font-semibold" style={{ color: "#aaa" }}>{fmt(s.rebounds_per_game)}</div>
              <div style={{ fontSize: "10px", color: "#555" }}>RPG</div>
            </div>
            <div className="text-right flex-shrink-0 hidden sm:block">
              <div className="text-sm font-semibold" style={{ color: "#aaa" }}>{fmt(s.assists_per_game)}</div>
              <div style={{ fontSize: "10px", color: "#555" }}>APG</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


/* ─── MAIN APP ─── */
export default function App() {
  const [sport, setSport] = useState("nba");
  const [tab, setTab] = useState("Scores");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchAllNBAData();
      setData(result);
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSelectPlayer = (player) => {
    setSelectedPlayer(player);
    setTab("_playerDetail");
  };

  const handleBackFromPlayer = () => {
    setSelectedPlayer(null);
    setTab("Players");
  };

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen error={error} onRetry={loadData} />;

  const activeTab = tab === "_playerDetail" ? "_playerDetail" : tab;

  return (
    <div className="min-h-screen" style={{ background: "#08080f", color: "#c8c8d0" }}>
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-50 backdrop-blur-xl" style={{ background: "rgba(8,8,15,0.92)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-3xl mx-auto px-4 pt-3 pb-0">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-black tracking-tight" style={{ color: "#e94560", letterSpacing: "-0.5px" }}>STATLINE</h1>
              <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
                {SPORTS.map((s) => (
                  <button key={s.id} onClick={() => s.active && setSport(s.id)} className="px-2 py-1 rounded-md text-xs font-bold transition-all" style={{
                    background: sport === s.id ? "rgba(233,69,96,0.15)" : "transparent",
                    color: sport === s.id ? s.color : s.active ? "#555" : "#333",
                    opacity: s.active ? 1 : 0.5,
                    cursor: s.active ? "pointer" : "default",
                  }}>
                    {s.icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-right">
              <span style={{ fontSize: "10px", color: "#444" }}>
                {data?.games?.length || 0} games · {data?.playerStats?.length || 0} players
              </span>
            </div>
          </div>

          {/* Tab bar — horizontally scrollable */}
          <div className="flex gap-0.5 overflow-x-auto pb-0 -mx-4 px-4" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {TABS.map((t) => {
              const isActive = activeTab === t || (activeTab === "_playerDetail" && t === "Players");
              return (
                <button key={t} onClick={() => { setTab(t); setSelectedPlayer(null); }} className="px-3.5 py-2 text-sm font-bold transition-all whitespace-nowrap relative" style={{ color: isActive ? "#e94560" : "#555" }}>
                  {t}
                  {isActive && <div className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full" style={{ background: "#e94560" }} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-3xl mx-auto px-4 py-5">
        {activeTab === "Scores" && <ScoresView games={data.games} teamMap={data.teamMap} />}
        {activeTab === "Standings" && <StandingsView east={data.east} west={data.west} teamMap={data.teamMap} />}
        {activeTab === "Players" && <PlayersView playerStats={data.playerStats} teamMap={data.teamMap} onSelectPlayer={handleSelectPlayer} />}
        {activeTab === "_playerDetail" && selectedPlayer && <PlayerDetail player={selectedPlayer} teamMap={data.teamMap} onBack={handleBackFromPlayer} />}
        {activeTab === "Compare" && <CompareView playerStats={data.playerStats} teamMap={data.teamMap} />}
        {activeTab === "Search" && <SearchView playerStats={data.playerStats} teamMap={data.teamMap} onSelectPlayer={handleSelectPlayer} />}
      </div>

      {/* ── Footer ── */}
      <div className="text-center py-6 mt-8" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <p style={{ fontSize: "11px", color: "#333" }}>StatLine · Sports stats made simple</p>
      </div>
    </div>
  );
}
