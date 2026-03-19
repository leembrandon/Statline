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

const TABS = ["Scores", "Schedule", "Standings", "Players", "Lines", "Compare"];

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
    return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  } catch { return ""; }
}
function formatGameDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" });
  } catch { return ""; }
}

/* share helper — generates an image from a ref */
function useShareImage() {
  const [sharing, setSharing] = useState(false);
  const share = useCallback((ref, filename) => {
    if (!ref.current || sharing) return;
    setSharing(true);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    script.onload = () => {
      window.html2canvas(ref.current, { backgroundColor: "#08080f", scale: 2, useCORS: true }).then((canvas) => {
        canvas.toBlob((blob) => {
          if (!blob) { setSharing(false); return; }
          const file = new File([blob], filename + ".png", { type: "image/png" });
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: filename }).catch(() => {}).finally(() => setSharing(false));
          } else {
            const link = document.createElement("a");
            link.download = filename + ".png";
            link.href = canvas.toDataURL("image/png");
            link.click();
            setSharing(false);
          }
        }, "image/png");
      }).catch(() => setSharing(false));
    };
    script.onerror = () => setSharing(false);
    document.head.appendChild(script);
  }, [sharing]);
  return { sharing, share };
}

/* ─── DATA LAYER ─── */
async function fetchAllNBAData() {
  const [pastGames, upcomingGames, standings, playerStats, players, teams] = await Promise.all([
    supaFetch("games", "select=*&sport=eq.nba&status=eq.final&order=start_time.desc&limit=50"),
    supaFetch("games", "select=*&sport=eq.nba&status=eq.scheduled&order=start_time.asc&limit=50"),
    supaFetch("standings", "select=*&sport=eq.nba&order=conference_rank.asc"),
    supaFetch("nba_player_stats", "select=*&order=points_per_game.desc&limit=1000"),
    supaFetch("players", "select=*&sport=eq.nba"),
    supaFetch("teams", "select=*&sport=eq.nba"),
  ]);

  // Also fetch any live games
  let liveGames = [];
  try { liveGames = await supaFetch("games", "select=*&sport=eq.nba&status=eq.in_progress"); } catch {}

  const games = [...liveGames, ...pastGames];

  const teamMap = {};
  teams.forEach((t) => (teamMap[t.id] = t));
  const playerMap = {};
  players.forEach((p) => (playerMap[p.id] = p));

  const enrichedStats = playerStats.map((s) => {
    const p = playerMap[s.player_id] || {};
    return { ...s, name: p.name, position: p.position, team_id: p.team_id, headshot_url: p.headshot_url, espn_id: p.espn_id, jersey_number: p.jersey_number, height: p.height, weight: p.weight, age: p.age };
  });

  const east = standings.filter((s) => {
    const t = teamMap[s.team_id];
    return t && t.conference && t.conference.toLowerCase().includes("east");
  });
  const west = standings.filter((s) => {
    const t = teamMap[s.team_id];
    return t && t.conference && t.conference.toLowerCase().includes("west");
  });

  // Build roster from stats, then fill in any players who have no stats row
  const teamRosters = {};
  const playerIdsWithStats = new Set();
  enrichedStats.forEach((s) => {
    if (s.team_id) {
      if (!teamRosters[s.team_id]) teamRosters[s.team_id] = [];
      teamRosters[s.team_id].push(s);
      if (s.player_id) playerIdsWithStats.add(s.player_id);
    }
  });

  // Add players from the players table who don't have stats yet
  const playersWithoutStats = [];
  players.forEach((p) => {
    if (p.team_id && !playerIdsWithStats.has(p.id)) {
      const stub = { player_id: p.id, name: p.name, position: p.position, team_id: p.team_id, headshot_url: p.headshot_url, espn_id: p.espn_id, jersey_number: p.jersey_number, height: p.height, weight: p.weight, age: p.age, points_per_game: null, rebounds_per_game: null, assists_per_game: null, steals_per_game: null, blocks_per_game: null, turnovers_per_game: null, fg_pct: null, fg3_pct: null, ft_pct: null, minutes_per_game: null, games_played: 0 };
      if (!teamRosters[p.team_id]) teamRosters[p.team_id] = [];
      teamRosters[p.team_id].push(stub);
      playersWithoutStats.push(stub);
    }
  });

  // Combine for search — stats players first, then stubs
  const allPlayers = [...enrichedStats, ...playersWithoutStats];

  // Standings lookup by team_id
  const standingsMap = {};
  standings.forEach((s) => (standingsMap[s.team_id] = s));

  // All games (past + live) for head-to-head calculations
  const allGames = [...pastGames, ...liveGames];

  return { games, upcomingGames, allGames, standings, east, west, playerStats: allPlayers, enrichedStats, playerMap, teamMap, teamRosters, standingsMap };
}

/* ─── SHARED UI ─── */
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#08080f" }}>
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: "#e94560", borderTopColor: "transparent" }} />
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
        <button onClick={onRetry} className="px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: "#e94560", color: "#fff" }}>Try again</button>
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

function ShareButton({ onClick, sharing, label }) {
  return (
    <button onClick={onClick} disabled={sharing} className="px-4 py-2 rounded-xl text-xs font-bold transition-all" style={{ background: sharing ? "rgba(233,69,96,0.2)" : "#e94560", color: "#fff", opacity: sharing ? 0.6 : 1 }}>
      {sharing ? "Generating..." : label || "📤 Share"}
    </button>
  );
}

function StatBox({ label, value, highlight }) {
  return (
    <div className="text-center p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
      <div style={{ fontSize: "9px", color: "#555", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>{label}</div>
      <div className="font-bold" style={{ fontSize: highlight ? "20px" : "15px", color: highlight ? "#fff" : "#c8c8d0" }}>{value}</div>
    </div>
  );
}

/* ── Search (clean, simple, reliable) ── */
function SimpleSearch({ playerStats, teamMap, standings, onSelectPlayer, onSelectTeam, onClose }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    if (query.length < 2) return { players: [], teams: [] };
    const q = query.toLowerCase();

    const players = playerStats.filter((p) => {
      if (!p.name) return false;
      const nameMatch = p.name.toLowerCase().includes(q);
      const team = teamMap[p.team_id] || {};
      return nameMatch || (team.abbreviation && team.abbreviation.toLowerCase().includes(q));
    }).sort((a, b) => (Number(b.points_per_game) || 0) - (Number(a.points_per_game) || 0)).slice(0, 10);

    const teamIds = new Set();
    const teams = Object.values(teamMap).filter((t) => {
      const match = (t.full_name && t.full_name.toLowerCase().includes(q)) ||
        (t.abbreviation && t.abbreviation.toLowerCase().includes(q)) ||
        (t.city && t.city.toLowerCase().includes(q)) ||
        (t.name && t.name.toLowerCase().includes(q));
      if (match && !teamIds.has(t.id)) { teamIds.add(t.id); return true; }
      return false;
    }).slice(0, 5);

    return { players, teams };
  }, [query, playerStats, teamMap]);

  const hasResults = results.players.length > 0 || results.teams.length > 0;

  return (
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(8,8,15,0.85)", backdropFilter: "blur(8px)" }} />
      <div className="relative max-w-lg mx-auto px-4 pt-4 pb-4 overflow-y-auto" style={{ maxHeight: "100vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 relative">
            <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search players or teams..." className="w-full p-3 pl-10 rounded-xl text-white placeholder-gray-500 outline-none" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", fontSize: "16px" }} />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <button onClick={onClose} className="px-3 py-3 rounded-xl text-sm font-semibold" style={{ color: "#888" }}>Cancel</button>
        </div>

        {query.length >= 2 && !hasResults && <p className="text-sm text-center py-8" style={{ color: "#555" }}>No results for "{query}"</p>}

        {results.teams.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-bold uppercase tracking-wider px-1 mb-2" style={{ color: "#e94560" }}>Teams</div>
            {results.teams.map((t) => {
              const standing = standings.find((s) => s.team_id === t.id);
              return (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/5 mb-1 transition-colors" style={{ background: "rgba(255,255,255,0.03)" }} onClick={() => { onSelectTeam(t.id); onClose(); }}>
                  {t.logo_url && <img src={t.logo_url} alt="" className="w-8 h-8 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate">{t.full_name}</div>
                    <div className="text-xs" style={{ color: "#555" }}>{t.conference} · {t.division}</div>
                  </div>
                  {standing && <div className="text-right flex-shrink-0"><div className="text-sm font-bold text-white">{standing.wins}-{standing.losses}</div><div style={{ fontSize: "10px", color: "#555" }}>#{standing.conference_rank}</div></div>}
                </div>
              );
            })}
          </div>
        )}

        {results.players.length > 0 && (
          <div>
            <div className="text-xs font-bold uppercase tracking-wider px-1 mb-2" style={{ color: "#e94560" }}>Players</div>
            {results.players.map((s, i) => {
              const team = teamMap[s.team_id] || {};
              return (
                <div key={s.id || i} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/5 mb-1 transition-colors" style={{ background: "rgba(255,255,255,0.03)" }} onClick={() => { onSelectPlayer(s); onClose(); }}>
                  {s.headshot_url && <img src={s.headshot_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate">{s.name}</div>
                    <div className="flex items-center gap-1.5">{team.logo_url && <img src={team.logo_url} alt="" className="w-3 h-3" />}<span style={{ fontSize: "11px", color: "#555" }}>{team.abbreviation} · {s.position}</span></div>
                  </div>
                  <div className="text-right flex-shrink-0"><div className="text-base font-bold text-white">{fmt(s.points_per_game)}</div><div style={{ fontSize: "10px", color: "#555" }}>PPG</div></div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Who's Hot ── */
function WhosHot({ playerStats, teamMap, onSelectPlayer }) {
  const [cat, setCat] = useState("points_per_game");
  const cats = [
    { key: "points_per_game", label: "PTS" },
    { key: "rebounds_per_game", label: "REB" },
    { key: "assists_per_game", label: "AST" },
    { key: "steals_per_game", label: "STL" },
    { key: "fg3_pct", label: "3P%" },
  ];

  const top5 = useMemo(() => {
    return [...playerStats].sort((a, b) => (Number(b[cat]) || 0) - (Number(a[cat]) || 0)).slice(0, 5);
  }, [playerStats, cat]);

  return (
    <div className="rounded-xl p-4 mb-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-white">Top performers</span>
        <div className="flex gap-1">
          {cats.map((c) => (
            <button key={c.key} onClick={() => setCat(c.key)} className="px-2 py-1 rounded text-xs font-semibold transition-all" style={{
              background: cat === c.key ? "rgba(233,69,96,0.15)" : "rgba(255,255,255,0.04)",
              color: cat === c.key ? "#e94560" : "#666",
            }}>{c.label}</button>
          ))}
        </div>
      </div>
      {top5.map((p, i) => {
        const team = teamMap[p.team_id] || {};
        return (
          <div key={p.id || p.player_id} className="flex items-center gap-3 py-2 cursor-pointer hover:bg-white/5 rounded-lg px-1 transition-colors" style={{ borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.03)" : "none" }} onClick={() => onSelectPlayer(p)}>
            <span className="text-xs font-bold w-5 text-center" style={{ color: i < 3 ? "#e94560" : "#555" }}>{i + 1}</span>
            {p.headshot_url && <img src={p.headshot_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />}
            <span className="text-sm font-semibold text-white flex-1 truncate">{p.name}</span>
            <div className="flex items-center gap-2">
              {team.logo_url && <img src={team.logo_url} alt="" className="w-3.5 h-3.5" />}
              <span className="text-xs" style={{ color: "#555" }}>{team.abbreviation}</span>
            </div>
            <span className="text-sm font-bold tabular-nums" style={{ color: "#e94560", minWidth: "40px", textAlign: "right" }}>
              {cat.includes("pct") ? fmt(Number(p[cat]), 1) : fmt(p[cat])}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Score Card (expandable) ── */
function ScoreCard({ game, teamMap, standingsMap, onTeamClick }) {
  const isFinal = game.status === "final";
  const isLive = game.status === "in_progress";
  const home = teamMap[game.home_team_id] || {};
  const away = teamMap[game.away_team_id] || {};
  const homeWon = isFinal && game.home_score > game.away_score;
  const awayWon = isFinal && game.away_score > game.home_score;
  const homeSt = standingsMap[game.home_team_id];
  const awaySt = standingsMap[game.away_team_id];

  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: "10px", color: "#555", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {isFinal ? "Final" : isLive ? game.status_detail || "Live" : formatGameTime(game.start_time)}
        </span>
        {isLive && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#ff3b30" }} /><span style={{ fontSize: "10px", fontWeight: 700, color: "#ff3b30" }}>LIVE</span></span>}
      </div>
      <div className="space-y-1.5">
        {[{ team: away, score: game.away_score, won: awayWon, lost: isFinal && !awayWon, id: game.away_team_id, st: awaySt },
          { team: home, score: game.home_score, won: homeWon, lost: isFinal && !homeWon, id: game.home_team_id, st: homeSt }].map((row, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer" onClick={() => onTeamClick(row.id)}>
              {row.team.logo_url && <img src={row.team.logo_url} alt="" className="w-5 h-5 flex-shrink-0" style={{ opacity: row.lost ? 0.4 : 1 }} />}
              <span className="text-sm font-semibold truncate" style={{ color: row.won ? "#fff" : row.lost ? "#555" : "#c8c8d0" }}>{row.team.abbreviation || "???"}</span>
              {row.st && <span style={{ fontSize: "10px", color: "#444", marginLeft: "2px" }}>{row.st.wins}-{row.st.losses}</span>}
            </div>
            <span className="text-base font-bold tabular-nums" style={{ color: row.won ? "#fff" : row.lost ? "#555" : "#c8c8d0" }}>{row.score != null ? row.score : "—"}</span>
          </div>
        ))}
      </div>
      {!isFinal && !isLive && <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}><span style={{ fontSize: "10px", color: "#444" }}>{formatGameDate(game.start_time)}</span></div>}
    </div>
  );
}

/* ── Scores Tab ── */
function ScoresView({ games, teamMap, standingsMap, playerStats, onSelectPlayer, onTeamClick }) {
  if (!games.length) return <EmptyState message="No games yet" sub="Run the NBA sync script to pull game data" />;
  const grouped = {};
  games.forEach((g) => {
    const dateKey = formatGameDate(g.start_time) || "Unknown";
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(g);
  });

  return (
    <div className="space-y-6">
      <WhosHot playerStats={playerStats} teamMap={teamMap} onSelectPlayer={onSelectPlayer} />
      {Object.entries(grouped).map(([date, dateGames]) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded" style={{ background: "#e94560" }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#888" }}>{date}</span>
            <span className="text-xs" style={{ color: "#444" }}>· {dateGames.length} games</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {dateGames.map((g) => <ScoreCard key={g.id} game={g} teamMap={teamMap} standingsMap={standingsMap} onTeamClick={onTeamClick} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Schedule Tab ── */
function ScheduleView({ upcomingGames, teamMap, standingsMap, onTeamClick }) {
  if (!upcomingGames.length) return <EmptyState message="No upcoming games" sub="Schedule data will appear once synced" />;

  const grouped = {};
  upcomingGames.forEach((g) => {
    const dateKey = formatGameDate(g.start_time) || "Unknown";
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(g);
  });

  return (
    <div className="space-y-5">
      {Object.entries(grouped).map(([date, dateGames]) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded" style={{ background: "#4a90d9" }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#888" }}>{date}</span>
            <span className="text-xs" style={{ color: "#444" }}>· {dateGames.length} games</span>
          </div>
          <div className="space-y-2">
            {dateGames.map((g) => {
              const home = teamMap[g.home_team_id] || {};
              const away = teamMap[g.away_team_id] || {};
              const homeSt = standingsMap[g.home_team_id];
              const awaySt = standingsMap[g.away_team_id];
              return (
                <div key={g.id} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontSize: "10px", color: "#4a90d9", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {formatGameTime(g.start_time)} ET
                    </span>
                    {g.venue && <span style={{ fontSize: "10px", color: "#444" }}>{g.venue}</span>}
                  </div>
                  <div className="space-y-2">
                    {[{ team: away, st: awaySt, id: g.away_team_id, label: "Away" },
                      { team: home, st: homeSt, id: g.home_team_id, label: "Home" }].map((row, i) => (
                      <div key={i} className="flex items-center justify-between cursor-pointer hover:bg-white/5 rounded-lg px-1 py-0.5 transition-colors" onClick={() => onTeamClick(row.id)}>
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {row.team.logo_url && <img src={row.team.logo_url} alt="" className="w-6 h-6 flex-shrink-0" />}
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-white truncate block">{row.team.full_name || row.team.abbreviation || "TBD"}</span>
                            {row.st && <span style={{ fontSize: "10px", color: "#555" }}>{row.st.wins}-{row.st.losses} · #{row.st.conference_rank} {row.team.conference}</span>}
                          </div>
                        </div>
                        <span style={{ fontSize: "10px", color: "#444", textTransform: "uppercase" }}>{row.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Playoff Race Tracker ── */
function PlayoffRace({ standings, teamMap, onTeamClick }) {
  if (!standings.length) return null;

  // Get the top team's pct for games back calculation context
  const getStatus = (rank, pct, gamesBack) => {
    if (rank <= 6) return { label: "Playoff", color: "#e94560", bg: "rgba(233,69,96,0.1)" };
    if (rank <= 10) return { label: "Play-in", color: "#ffd166", bg: "rgba(255,209,102,0.1)" };
    return { label: "Out", color: "#ff6b6b", bg: "rgba(255,107,107,0.08)" };
  };

  return (
    <div className="rounded-xl overflow-hidden mb-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="px-3 py-2.5" style={{ background: "rgba(233,69,96,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#e94560" }}>Playoff race</span>
      </div>
      {standings.slice(0, 12).map((s, i) => {
        const t = teamMap[s.team_id] || {};
        const rank = s.conference_rank || i + 1;
        const status = getStatus(rank, s.pct, s.games_back);
        const pctVal = s.pct != null ? Number(s.pct) : 0;
        const barWidth = Math.max(pctVal * 100, 5);

        return (
          <div key={s.id} className="px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => onTeamClick(s.team_id)} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold" style={{ width: "18px", color: status.color }}>{rank}</span>
              {t.logo_url && <img src={t.logo_url} alt="" className="w-4 h-4 flex-shrink-0" />}
              <span className="text-sm font-semibold text-white flex-1 truncate">{t.abbreviation}</span>
              <span className="text-xs font-semibold tabular-nums" style={{ color: "#aaa" }}>{s.wins}-{s.losses}</span>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: status.bg, color: status.color, fontSize: "9px" }}>{status.label}</span>
            </div>
            {/* Win % bar */}
            <div className="ml-6 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, background: status.color, opacity: 0.6 }} />
              </div>
              <span className="text-xs tabular-nums" style={{ color: "#555", minWidth: "32px", textAlign: "right" }}>{fmt(s.pct, 3)}</span>
            </div>
            {/* Divider lines between sections */}
            {(rank === 6 || rank === 10) && <div className="mt-2 border-t border-dashed" style={{ borderColor: rank === 6 ? "rgba(233,69,96,0.3)" : "rgba(255,209,102,0.3)" }} />}
          </div>
        );
      })}
    </div>
  );
}

/* ── Standings Tab ── */
function StandingsTable({ label, standings, teamMap, onTeamClick }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="px-3 py-2.5" style={{ background: "rgba(233,69,96,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#e94560" }}>{label}</span>
      </div>
      <div className="px-3 py-1.5 grid items-center" style={{ gridTemplateColumns: "22px 1fr 36px 36px 48px 48px 48px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: "10px", color: "#555", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        <span>#</span><span>Team</span><span className="text-center">W</span><span className="text-center">L</span><span className="text-center">PCT</span>
        <span className="text-center hidden sm:block">STRK</span><span className="text-center hidden sm:block">HOME</span>
      </div>
      {standings.map((s, i) => {
        const t = teamMap[s.team_id] || {};
        const rank = s.conference_rank || i + 1;
        const isPlayIn = rank > 6 && rank <= 10;
        return (
          <div key={s.id} className="px-3 py-2 grid items-center cursor-pointer hover:bg-white/5 transition-colors" onClick={() => onTeamClick(s.team_id)} style={{
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
    </div>
  );
}

function StandingsView({ east, west, teamMap, standings, onTeamClick }) {
  if (!east.length && !west.length) return <EmptyState message="No standings data" sub="Run the sync script to populate standings" />;

  const [view, setView] = useState("standings");

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex gap-1.5 mb-2">
        {[{ key: "standings", label: "Standings" }, { key: "playoff", label: "Playoff race" }].map((v) => (
          <button key={v.key} onClick={() => setView(v.key)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all" style={{
            background: view === v.key ? "rgba(233,69,96,0.15)" : "rgba(255,255,255,0.04)",
            color: view === v.key ? "#e94560" : "#666",
            border: view === v.key ? "1px solid rgba(233,69,96,0.3)" : "1px solid transparent",
          }}>{v.label}</button>
        ))}
      </div>

      {view === "standings" && (
        <>
          <StandingsTable label="Eastern Conference" standings={east} teamMap={teamMap} onTeamClick={onTeamClick} />
          <StandingsTable label="Western Conference" standings={west} teamMap={teamMap} onTeamClick={onTeamClick} />
          <div className="flex items-center gap-4 mt-2" style={{ fontSize: "10px", color: "#555" }}>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: "#e94560" }} /> Playoff</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: "#ffd166" }} /> Play-in</span>
          </div>
        </>
      )}

      {view === "playoff" && (
        <>
          <PlayoffRace standings={east} teamMap={teamMap} onTeamClick={onTeamClick} />
          <PlayoffRace standings={west} teamMap={teamMap} onTeamClick={onTeamClick} />
        </>
      )}
    </div>
  );
}

/* ── Team Page ── */
function TeamPage({ teamId, teamMap, standings, playerStats, games, allGames, upcomingGames, teamRosters, onBack, onSelectPlayer, onTeamClick }) {
  const team = teamMap[teamId] || {};
  const standing = standings.find((s) => s.team_id === teamId) || {};
  const roster = teamRosters[teamId] || [];
  const recentGames = games.filter((g) => g.home_team_id === teamId || g.away_team_id === teamId).slice(0, 10);
  const upcoming = upcomingGames.filter((g) => g.home_team_id === teamId || g.away_team_id === teamId).slice(0, 5);
  const cardRef = useRef(null);
  const { sharing, share } = useShareImage();

  // Head-to-head season series — calculate from allGames
  const h2h = useMemo(() => {
    const teamGames = allGames.filter((g) => g.status === "final" && (g.home_team_id === teamId || g.away_team_id === teamId));
    const opponents = {};
    teamGames.forEach((g) => {
      const isHome = g.home_team_id === teamId;
      const oppId = isHome ? g.away_team_id : g.home_team_id;
      const teamScore = isHome ? g.home_score : g.away_score;
      const oppScore = isHome ? g.away_score : g.home_score;
      if (!opponents[oppId]) opponents[oppId] = { wins: 0, losses: 0, games: 0 };
      opponents[oppId].games++;
      if (teamScore > oppScore) opponents[oppId].wins++;
      else opponents[oppId].losses++;
    });
    // Only show opponents played more than once (series)
    return Object.entries(opponents)
      .filter(([, v]) => v.games >= 2)
      .sort((a, b) => b[1].games - a[1].games)
      .slice(0, 8);
  }, [allGames, teamId]);

  return (
    <div>
      <button onClick={onBack} className="text-xs font-semibold mb-4 flex items-center gap-1" style={{ color: "#e94560" }}>← Back</button>

      <div ref={cardRef} className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-4 mb-4">
          {team.logo_url && <img src={team.logo_url} alt="" className="w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-black text-white truncate">{team.full_name}</h2>
            <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: "#888" }}>
              <span>{team.conference}</span><span>·</span><span>{team.division}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatBox label="Record" value={`${standing.wins || 0}-${standing.losses || 0}`} highlight />
          <StatBox label="Conf rank" value={standing.conference_rank ? `#${standing.conference_rank}` : "—"} highlight />
          <StatBox label="Win %" value={standing.pct != null ? fmt(standing.pct, 3) : "—"} />
          <StatBox label="Streak" value={standing.streak || "—"} />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <StatBox label="Home" value={standing.home_record || "—"} />
          <StatBox label="Away" value={standing.away_record || "—"} />
        </div>
        <div className="mt-3 text-right"><span style={{ fontSize: "10px", color: "#333", fontWeight: 700 }}>STATLINE</span></div>
      </div>

      <div className="flex justify-center mb-5">
        <ShareButton onClick={() => share(cardRef, `statline-${team.abbreviation}`)} sharing={sharing} label="📤 Share team card" />
      </div>

      {/* Upcoming games */}
      {upcoming.length > 0 && (
        <div className="mb-6">
          <div className="text-xs uppercase tracking-wider font-bold mb-3" style={{ color: "#4a90d9" }}>Upcoming</div>
          {upcoming.map((g) => {
            const isHome = g.home_team_id === teamId;
            const opp = teamMap[isHome ? g.away_team_id : g.home_team_id] || {};
            return (
              <div key={g.id} className="flex items-center justify-between p-3 rounded-lg mb-1.5 cursor-pointer hover:bg-white/5 transition-colors" style={{ background: "rgba(74,144,217,0.05)", border: "1px solid rgba(74,144,217,0.1)" }} onClick={() => onTeamClick(isHome ? g.away_team_id : g.home_team_id)}>
                <div className="flex items-center gap-3">
                  {opp.logo_url && <img src={opp.logo_url} alt="" className="w-5 h-5" />}
                  <span className="text-sm font-semibold text-white">{isHome ? "vs" : "@"} {opp.full_name || opp.abbreviation}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold" style={{ color: "#4a90d9" }}>{formatGameDate(g.start_time)}</div>
                  <div style={{ fontSize: "10px", color: "#555" }}>{formatGameTime(g.start_time)} ET</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Head-to-head season series */}
      {h2h.length > 0 && (
        <div className="mb-6">
          <div className="text-xs uppercase tracking-wider font-bold mb-3" style={{ color: "#e94560" }}>Season series</div>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            {h2h.map(([oppId, record], i) => {
              const opp = teamMap[oppId] || {};
              const winning = record.wins > record.losses;
              const tied = record.wins === record.losses;
              return (
                <div key={oppId} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => onTeamClick(oppId)} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", background: i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                  {opp.logo_url && <img src={opp.logo_url} alt="" className="w-5 h-5 flex-shrink-0" />}
                  <span className="text-sm font-semibold text-white flex-1 truncate">{opp.full_name || opp.abbreviation}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: winning ? "#52b788" : tied ? "#ffd166" : "#ff6b6b" }}>
                    {record.wins}-{record.losses}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{
                    background: winning ? "rgba(82,183,136,0.12)" : tied ? "rgba(255,209,102,0.12)" : "rgba(255,107,107,0.12)",
                    color: winning ? "#52b788" : tied ? "#ffd166" : "#ff6b6b",
                    fontSize: "9px", fontWeight: 700,
                  }}>{winning ? "LEAD" : tied ? "TIED" : "TRAIL"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Roster */}
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wider font-bold mb-3" style={{ color: "#e94560" }}>Roster · {roster.length} players</div>
        {roster.length > 0 ? (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            {roster.sort((a, b) => (Number(b.points_per_game) || 0) - (Number(a.points_per_game) || 0)).map((p, i) => (
              <div key={p.id || i} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", background: i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent" }} onClick={() => onSelectPlayer(p)}>
                {p.headshot_url && <img src={p.headshot_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-white truncate block">{p.name}</span>
                  <span style={{ fontSize: "10px", color: "#555" }}>{p.position}{p.jersey_number ? ` · #${p.jersey_number}` : ""}</span>
                </div>
                <div className="flex gap-3 flex-shrink-0">
                  <div className="text-center"><div style={{ fontSize: "9px", color: "#555" }}>PTS</div><div className="text-xs font-bold text-white">{fmt(p.points_per_game)}</div></div>
                  <div className="text-center"><div style={{ fontSize: "9px", color: "#555" }}>REB</div><div className="text-xs font-semibold" style={{ color: "#aaa" }}>{fmt(p.rebounds_per_game)}</div></div>
                  <div className="text-center"><div style={{ fontSize: "9px", color: "#555" }}>AST</div><div className="text-xs font-semibold" style={{ color: "#aaa" }}>{fmt(p.assists_per_game)}</div></div>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-xs" style={{ color: "#555" }}>No roster data available</p>}
      </div>

      {/* Recent games */}
      <div>
        <div className="text-xs uppercase tracking-wider font-bold mb-3" style={{ color: "#e94560" }}>Recent games</div>
        {recentGames.length > 0 ? recentGames.map((g) => {
          const isHome = g.home_team_id === teamId;
          const opp = teamMap[isHome ? g.away_team_id : g.home_team_id] || {};
          const teamScore = isHome ? g.home_score : g.away_score;
          const oppScore = isHome ? g.away_score : g.home_score;
          const won = g.status === "final" && teamScore > oppScore;
          const lost = g.status === "final" && teamScore < oppScore;
          return (
            <div key={g.id} className="flex items-center justify-between p-3 rounded-lg mb-1.5" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: won ? "rgba(82,183,136,0.15)" : lost ? "rgba(255,107,107,0.15)" : "rgba(255,255,255,0.05)", color: won ? "#52b788" : lost ? "#ff6b6b" : "#888" }}>{won ? "W" : lost ? "L" : "—"}</span>
                <div className="flex items-center gap-2">
                  {opp.logo_url && <img src={opp.logo_url} alt="" className="w-4 h-4" />}
                  <span className="text-sm font-semibold text-white">{isHome ? "vs" : "@"} {opp.abbreviation}</span>
                </div>
              </div>
              <div className="text-right">
                {g.status === "final" ? <span className="text-sm font-bold tabular-nums" style={{ color: won ? "#52b788" : "#ff6b6b" }}>{teamScore}-{oppScore}</span>
                  : <span className="text-xs" style={{ color: "#555" }}>{formatGameDate(g.start_time)}</span>}
              </div>
            </div>
          );
        }) : <p className="text-xs" style={{ color: "#555" }}>No recent games</p>}
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
  const sorted = useMemo(() => [...playerStats].sort((a, b) => (Number(b[sortBy]) || 0) - (Number(a[sortBy]) || 0)), [playerStats, sortBy]);
  const sortLabel = sortOptions.find((o) => o.key === sortBy)?.label || "";

  if (!playerStats.length) return <EmptyState message="No player data" sub="Run the sync script to pull player stats" />;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {sortOptions.map((opt) => (
          <button key={opt.key} onClick={() => setSortBy(opt.key)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all" style={{
            background: sortBy === opt.key ? "rgba(233,69,96,0.15)" : "rgba(255,255,255,0.04)",
            color: sortBy === opt.key ? "#e94560" : "#666",
            border: sortBy === opt.key ? "1px solid rgba(233,69,96,0.3)" : "1px solid transparent",
          }}>{opt.label}</button>
        ))}
      </div>
      <div className="text-xs mb-3" style={{ color: "#555" }}>{sorted.length} players · Sorted by {sortLabel}</div>
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        {sorted.map((s, i) => {
          const team = teamMap[s.team_id] || {};
          const mainVal = Number(s[sortBy]) || 0;
          return (
            <div key={s.id || i} className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-white/5 transition-colors" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }} onClick={() => onSelectPlayer(s)}>
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
              <div className="text-center hidden sm:block" style={{ minWidth: "40px" }}><div style={{ fontSize: "9px", color: "#555" }}>PTS</div><div className="text-xs font-semibold" style={{ color: "#aaa" }}>{fmt(s.points_per_game)}</div></div>
              <div className="text-center hidden sm:block" style={{ minWidth: "40px" }}><div style={{ fontSize: "9px", color: "#555" }}>REB</div><div className="text-xs font-semibold" style={{ color: "#aaa" }}>{fmt(s.rebounds_per_game)}</div></div>
              <div className="text-center hidden sm:block" style={{ minWidth: "40px" }}><div style={{ fontSize: "9px", color: "#555" }}>AST</div><div className="text-xs font-semibold" style={{ color: "#aaa" }}>{fmt(s.assists_per_game)}</div></div>
              <div className="text-center flex-shrink-0" style={{ minWidth: "48px" }}>
                <div style={{ fontSize: "9px", color: "#555" }}>{sortLabel}</div>
                <div className="text-base font-bold" style={{ color: i < 3 ? "#e94560" : "#fff" }}>{fmt(mainVal, 1)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


/* ── Player Game Log (data hook) ── */
function usePlayerGameLog(playerId, teamMap) {
  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("L5");
  const [matchupFilter, setMatchupFilter] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const boxData = await supaFetch("nba_box_scores", `select=*&player_id=eq.${playerId}&limit=50`);
        if (!boxData || boxData.length === 0) { setLogs([]); return; }
        const gameIds = [...new Set(boxData.map((b) => b.game_id))];
        const gamesData = await supaFetch("games", `select=*&id=in.(${gameIds.join(",")})`);
        const gm = {};
        (gamesData || []).forEach((g) => (gm[g.id] = g));
        setLogs(boxData.map((b) => ({ ...b, _game: gm[b.game_id] })));
      } catch (e) { console.error(e); setLogs([]); }
      finally { setLoading(false); }
    })();
  }, [playerId]);

  const enriched = useMemo(() => {
    if (!logs) return [];
    return logs.map((log) => {
      const game = log._game || {};
      const isHome = log.team_id === game.home_team_id;
      const oppId = isHome ? game.away_team_id : game.home_team_id;
      return { ...log, opp: teamMap[oppId] || {}, oppId, isHome, won: isHome ? game.home_score > game.away_score : game.away_score > game.home_score, gameDate: game.game_date };
    }).filter((l) => l.gameDate).sort((a, b) => b.gameDate.localeCompare(a.gameDate));
  }, [logs, teamMap]);

  const opponents = useMemo(() => {
    const map = {};
    enriched.forEach((l) => { if (l.oppId && l.opp.abbreviation) map[l.oppId] = l.opp; });
    return map;
  }, [enriched]);

  const filtered = matchupFilter ? enriched.filter((l) => l.oppId === matchupFilter) : enriched;
  const rangeMap = { L5: 5, L10: 10, L15: 15, ALL: 999 };
  const sliced = filtered.slice(0, rangeMap[range] || 5);

  const avg = (arr, key) => arr.length ? arr.reduce((s, g) => s + (Number(g[key]) || 0), 0) / arr.length : 0;
  const avgStats = sliced.length > 0 ? {
    pts: avg(sliced, "points"), reb: avg(sliced, "rebounds"), ast: avg(sliced, "assists"),
    stl: avg(sliced, "steals"), blk: avg(sliced, "blocks"), to: avg(sliced, "turnovers"),
    min: avg(sliced, "minutes"), fgm: avg(sliced, "fg_made"), fga: avg(sliced, "fg_attempted"),
    fg3m: avg(sliced, "fg3_made"), fg3a: avg(sliced, "fg3_attempted"),
  } : null;

  return { loading, enriched, sliced, avgStats, opponents, range, setRange, matchupFilter, setMatchupFilter, matchupOpp: matchupFilter ? teamMap[matchupFilter] : null };
}

/* ── Game Log UI ── */
function PlayerGameLogUI({ playerId, teamMap }) {
  const { loading, sliced, avgStats, opponents, range, setRange, matchupFilter, setMatchupFilter, matchupOpp } = usePlayerGameLog(playerId, teamMap);

  if (loading) return <div className="py-4 text-center"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: "#e94560", borderTopColor: "transparent" }} /></div>;
  if (sliced.length === 0 && !matchupFilter) return <div className="py-4 text-center text-xs" style={{ color: "#555" }}>No game log data — run <code className="px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)" }}>python sync_nba.py boxscores</code></div>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {["L5", "L10", "L15", "ALL"].map((r) => (
          <button key={r} onClick={() => setRange(r)} className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all" style={{
            background: range === r ? "rgba(233,69,96,0.15)" : "rgba(255,255,255,0.04)",
            color: range === r ? "#e94560" : "#666",
            border: range === r ? "1px solid rgba(233,69,96,0.3)" : "1px solid transparent",
          }}>{r === "ALL" ? "All" : r}</button>
        ))}
        <div style={{ width: "1px", background: "rgba(255,255,255,0.08)", margin: "0 2px", alignSelf: "stretch", minHeight: "20px" }} />
        <button onClick={() => setMatchupFilter(null)} className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all" style={{ background: !matchupFilter ? "rgba(74,144,217,0.15)" : "rgba(255,255,255,0.04)", color: !matchupFilter ? "#4a90d9" : "#666" }}>All</button>
        {Object.entries(opponents).slice(0, 6).map(([id, opp]) => (
          <button key={id} onClick={() => setMatchupFilter(matchupFilter === id ? null : id)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all" style={{
            background: matchupFilter === id ? "rgba(74,144,217,0.15)" : "rgba(255,255,255,0.04)",
            color: matchupFilter === id ? "#4a90d9" : "#666",
          }}>{opp.logo_url && <img src={opp.logo_url} alt="" className="w-3 h-3" />}{opp.abbreviation}</button>
        ))}
      </div>

      {avgStats && (
        <div className="rounded-xl p-3 mb-3" style={{ background: matchupFilter ? "rgba(74,144,217,0.06)" : "rgba(233,69,96,0.04)", border: `1px solid ${matchupFilter ? "rgba(74,144,217,0.15)" : "rgba(233,69,96,0.1)"}` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold" style={{ color: matchupFilter ? "#4a90d9" : "#e94560" }}>{matchupFilter ? `vs ${matchupOpp?.abbreviation || "?"} avg` : `${range === "ALL" ? "Season" : range} averages`}</span>
            <span className="text-xs" style={{ color: "#555" }}>{sliced.length} games</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[["PTS", avgStats.pts, true], ["REB", avgStats.reb, true], ["AST", avgStats.ast, true], ["STL", avgStats.stl], ["BLK", avgStats.blk], ["MIN", avgStats.min]].map(([l, v, big]) => (
              <div key={l} className="text-center"><div style={{ fontSize: "9px", color: "#555" }}>{l}</div><div className={`font-bold ${big ? "text-base text-white" : "text-sm"}`} style={big ? {} : { color: "#aaa" }}>{v.toFixed(l === "MIN" ? 0 : 1)}</div></div>
            ))}
          </div>
          {avgStats.fga > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="text-center"><div style={{ fontSize: "9px", color: "#555" }}>FG</div><div className="text-xs font-semibold" style={{ color: "#aaa" }}>{avgStats.fgm.toFixed(1)}/{avgStats.fga.toFixed(1)}</div></div>
              <div className="text-center"><div style={{ fontSize: "9px", color: "#555" }}>3PT</div><div className="text-xs font-semibold" style={{ color: "#aaa" }}>{avgStats.fg3m.toFixed(1)}/{avgStats.fg3a.toFixed(1)}</div></div>
              <div className="text-center"><div style={{ fontSize: "9px", color: "#555" }}>FG%</div><div className="text-xs font-semibold" style={{ color: "#aaa" }}>{((avgStats.fgm / avgStats.fga) * 100).toFixed(1)}%</div></div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="px-2 py-1.5 grid items-center" style={{ gridTemplateColumns: "60px 1fr 32px 32px 32px 32px 32px 32px", fontSize: "9px", color: "#555", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span>Date</span><span>OPP</span><span className="text-center">PTS</span><span className="text-center">REB</span><span className="text-center">AST</span>
          <span className="text-center hidden sm:block">STL</span><span className="text-center hidden sm:block">BLK</span><span className="text-center">MIN</span>
        </div>
        {sliced.map((g, i) => (
          <div key={g.id} className="px-2 py-1.5 grid items-center" style={{ gridTemplateColumns: "60px 1fr 32px 32px 32px 32px 32px 32px", borderBottom: "1px solid rgba(255,255,255,0.02)", background: i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent" }}>
            <span style={{ fontSize: "10px", color: "#555" }}>{g.gameDate ? new Date(g.gameDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</span>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold px-1 py-0.5 rounded" style={{ background: g.won ? "rgba(82,183,136,0.12)" : "rgba(255,107,107,0.12)", color: g.won ? "#52b788" : "#ff6b6b", fontSize: "9px" }}>{g.won ? "W" : "L"}</span>
              {g.opp.logo_url && <img src={g.opp.logo_url} alt="" className="w-3.5 h-3.5" />}
              <span className="text-xs truncate" style={{ color: "#888" }}>{g.isHome ? "vs" : "@"} {g.opp.abbreviation}</span>
            </div>
            <span className="text-xs text-center font-bold text-white tabular-nums">{g.points}</span>
            <span className="text-xs text-center tabular-nums" style={{ color: "#aaa" }}>{g.rebounds}</span>
            <span className="text-xs text-center tabular-nums" style={{ color: "#aaa" }}>{g.assists}</span>
            <span className="text-xs text-center tabular-nums hidden sm:block" style={{ color: "#666" }}>{g.steals}</span>
            <span className="text-xs text-center tabular-nums hidden sm:block" style={{ color: "#666" }}>{g.blocks}</span>
            <span className="text-xs text-center tabular-nums" style={{ color: "#666" }}>{g.minutes}</span>
          </div>
        ))}
        {sliced.length === 0 && <div className="p-4 text-center text-xs" style={{ color: "#555" }}>{matchupFilter ? `No games vs ${matchupOpp?.abbreviation || "this team"}` : "No games found"}</div>}
      </div>
    </div>
  );
}

/* ── Line Check Tool ── */
function LineCheck({ playerId, player, teamMap }) {
  const [stat, setStat] = useState("points");
  const [threshold, setThreshold] = useState("");
  const [direction, setDirection] = useState("over");
  const [range, setRange] = useState(10);
  const { loading, enriched } = usePlayerGameLog(playerId, teamMap);
  const cardRef = useRef(null);
  const { sharing, share } = useShareImage();
  const team = player ? (teamMap[player.team_id] || {}) : {};

  if (loading) return <div className="py-3 text-center"><div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: "#52b788", borderTopColor: "transparent" }} /></div>;
  if (!enriched || enriched.length === 0) return <div className="py-3 text-center text-xs" style={{ color: "#555" }}>No game data available for line checks</div>;

  const statOptions = [
    { key: "points", label: "Points", short: "PTS" }, { key: "rebounds", label: "Rebounds", short: "REB" },
    { key: "assists", label: "Assists", short: "AST" }, { key: "steals", label: "Steals", short: "STL" },
    { key: "blocks", label: "Blocks", short: "BLK" }, { key: "fg3_made", label: "3-Pointers", short: "3PT" },
  ];

  const threshNum = Number(threshold);
  const recent = enriched.slice(0, range);
  const hasThreshold = threshold !== "" && !isNaN(threshNum);
  const hits = hasThreshold ? recent.filter((g) => direction === "over" ? (Number(g[stat]) || 0) >= threshNum : (Number(g[stat]) || 0) < threshNum) : [];
  const hitPct = hasThreshold && recent.length > 0 ? (hits.length / recent.length * 100) : 0;
  const statLabel = statOptions.find((s) => s.key === stat)?.label || stat;

  return (
    <div>
      {/* Controls */}
      <div className="rounded-xl p-3 mb-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {statOptions.map((s) => (
            <button key={s.key} onClick={() => setStat(s.key)} className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all" style={{
              background: stat === s.key ? "rgba(82,183,136,0.15)" : "rgba(255,255,255,0.04)",
              color: stat === s.key ? "#52b788" : "#666",
            }}>{s.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            <button onClick={() => setDirection("over")} className="px-3 py-2 text-xs font-bold transition-all" style={{ background: direction === "over" ? "rgba(82,183,136,0.2)" : "transparent", color: direction === "over" ? "#52b788" : "#666" }}>Over</button>
            <button onClick={() => setDirection("under")} className="px-3 py-2 text-xs font-bold transition-all" style={{ background: direction === "under" ? "rgba(255,107,107,0.2)" : "transparent", color: direction === "under" ? "#ff6b6b" : "#666" }}>Under</button>
          </div>
          <input type="number" inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="Line" className="p-2 rounded-lg text-white text-sm text-center outline-none" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", width: "72px", fontSize: "16px" }} />
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            {[5, 10, 15, 20].map((n) => (
              <button key={n} onClick={() => setRange(n)} className="px-2.5 py-2 text-xs font-bold transition-all" style={{ background: range === n ? "rgba(233,69,96,0.15)" : "transparent", color: range === n ? "#e94560" : "#666" }}>L{n}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Result card (shareable — includes player info) */}
      {hasThreshold && (
        <div>
          <div ref={cardRef} className="rounded-xl p-4 mb-2" style={{ background: hitPct >= 60 ? "rgba(82,183,136,0.06)" : hitPct >= 40 ? "rgba(255,209,102,0.06)" : "rgba(255,107,107,0.06)", border: `1px solid ${hitPct >= 60 ? "rgba(82,183,136,0.15)" : hitPct >= 40 ? "rgba(255,209,102,0.15)" : "rgba(255,107,107,0.15)"}` }}>
            {/* Player info header inside shareable area */}
            {player && (
              <div className="flex items-center gap-3 mb-3 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                {player.headshot_url && <img src={player.headshot_url} alt="" className="w-10 h-10 rounded-full object-cover" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">{player.name}</div>
                  <div className="flex items-center gap-1.5">
                    {team.logo_url && <img src={team.logo_url} alt="" className="w-3.5 h-3.5" />}
                    <span style={{ fontSize: "11px", color: "#555" }}>{team.abbreviation} · {player.position}</span>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-bold uppercase" style={{ color: hitPct >= 60 ? "#52b788" : hitPct >= 40 ? "#ffd166" : "#ff6b6b" }}>{direction} {threshNum} {statLabel}</div>
                <div className="text-xs" style={{ color: "#555" }}>Last {recent.length} games</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black" style={{ color: hitPct >= 60 ? "#52b788" : hitPct >= 40 ? "#ffd166" : "#ff6b6b" }}>{hits.length}/{recent.length}</div>
                <div className="text-sm font-bold" style={{ color: hitPct >= 60 ? "#52b788" : hitPct >= 40 ? "#ffd166" : "#ff6b6b" }}>{hitPct.toFixed(0)}%</div>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {recent.map((g, i) => {
                const val = Number(g[stat]) || 0;
                const hit = direction === "over" ? val >= threshNum : val < threshNum;
                return (
                  <div key={i} className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold" style={{ background: hit ? "rgba(82,183,136,0.2)" : "rgba(255,107,107,0.15)", color: hit ? "#52b788" : "#ff6b6b", fontSize: "10px" }}>{val}</div>
                    <span style={{ fontSize: "8px", color: "#444", marginTop: "2px" }}>{g.opp?.abbreviation}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ fontSize: "10px", color: "#333", fontWeight: 700 }}>STATLINE</span>
              <span style={{ fontSize: "10px", color: "#444" }}>Season avg: {player ? fmt(player[stat === "fg3_made" ? "fg3_pct" : stat.replace("s", "s_per_game")] || player.points_per_game) : "—"}</span>
            </div>
          </div>
          <div className="flex justify-center mb-2">
            <ShareButton onClick={() => share(cardRef, `statline-${player?.name?.replace(/\s+/g, "-") || "line"}-${direction}-${threshNum}-${statOptions.find((s) => s.key === stat)?.short || stat}`)} sharing={sharing} label="📤 Share line check" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Player Detail (the killer page) ── */
function PlayerDetail({ player, teamMap, onBack, onTeamClick }) {
  const team = teamMap[player.team_id] || {};
  const cardRef = useRef(null);
  const { sharing, share } = useShareImage();
  const pid = player.player_id || player.id;

  return (
    <div>
      <button onClick={onBack} className="text-xs font-semibold mb-4 flex items-center gap-1" style={{ color: "#e94560" }}>← Back</button>

      <div ref={cardRef} className="rounded-xl p-4 mb-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-4">
          {player.headshot_url && <img src={player.headshot_url} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-black text-white truncate">{player.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {team.logo_url && <img src={team.logo_url} alt="" className="w-4 h-4 cursor-pointer" onClick={() => onTeamClick(player.team_id)} />}
              <span className="text-sm cursor-pointer hover:underline" style={{ color: "#888" }} onClick={() => onTeamClick(player.team_id)}>{team.full_name || team.name}</span>
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
        <div className="mt-4">
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
        <div className="mt-3">
          <div className="text-xs uppercase tracking-wider font-bold mb-2" style={{ color: "#e94560" }}>Shooting</div>
          <div className="grid grid-cols-4 gap-1.5">
            <StatBox label="FG%" value={fmt(player.fg_pct)} />
            <StatBox label="3P%" value={fmt(player.fg3_pct)} />
            <StatBox label="FT%" value={fmt(player.ft_pct)} />
            <StatBox label="MIN" value={fmt(player.minutes_per_game)} />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs" style={{ color: "#555" }}>{player.games_played} games played</span>
          <span style={{ fontSize: "10px", color: "#333", fontWeight: 700 }}>STATLINE</span>
        </div>
      </div>
      <div className="flex justify-center mb-6">
        <ShareButton onClick={() => share(cardRef, `statline-${player.name?.replace(/\s+/g, "-")}`)} sharing={sharing} label="📤 Share player card" />
      </div>

      {/* Line Check Tool */}
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wider font-bold mb-3" style={{ color: "#52b788" }}>Line check</div>
        <LineCheck playerId={pid} player={player} teamMap={teamMap} />
      </div>

      {/* Recent Form & Game Log */}
      <div className="mb-4">
        <div className="text-xs uppercase tracking-wider font-bold mb-3" style={{ color: "#e94560" }}>Recent form & game log</div>
        <PlayerGameLogUI playerId={pid} teamMap={teamMap} />
      </div>
    </div>
  );
}

/* ── Lines Tab (dedicated top-level line checker) ── */
function LinesTab({ playerStats, teamMap }) {
  const [query, setQuery] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const results = useMemo(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    return playerStats.filter((p) => p.name && p.name.toLowerCase().includes(q))
      .sort((a, b) => (Number(b.points_per_game) || 0) - (Number(a.points_per_game) || 0))
      .slice(0, 8);
  }, [query, playerStats]);

  const team = selectedPlayer ? (teamMap[selectedPlayer.team_id] || {}) : {};

  return (
    <div>
      {!selectedPlayer ? (
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white mb-1">Line check</h2>
            <p className="text-xs" style={{ color: "#555" }}>Search a player to check how often they hit a stat line</p>
          </div>
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search player..." className="w-full p-3 rounded-xl text-white placeholder-gray-600 outline-none mb-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", fontSize: "16px" }} />
          
          {/* Search results */}
          {results.length > 0 && (
            <div className="space-y-1">
              {results.map((p, i) => {
                const t = teamMap[p.team_id] || {};
                return (
                  <div key={p.id || i} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-colors" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }} onClick={() => { setSelectedPlayer(p); setQuery(""); }}>
                    {p.headshot_url && <img src={p.headshot_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">{p.name}</div>
                      <div className="flex items-center gap-1.5">{t.logo_url && <img src={t.logo_url} alt="" className="w-3 h-3" />}<span style={{ fontSize: "11px", color: "#555" }}>{t.abbreviation} · {p.position}</span></div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-white">{fmt(p.points_per_game)}</div>
                      <div style={{ fontSize: "10px", color: "#555" }}>PPG</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Popular players when no search */}
          {query.length < 2 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#555" }}>Top scorers</div>
              <div className="space-y-1">
                {playerStats.filter((p) => p.points_per_game).sort((a, b) => (Number(b.points_per_game) || 0) - (Number(a.points_per_game) || 0)).slice(0, 12).map((p, i) => {
                  const t = teamMap[p.team_id] || {};
                  return (
                    <div key={p.id || i} className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-white/5 transition-colors" style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }} onClick={() => setSelectedPlayer(p)}>
                      <span className="text-xs font-bold w-5 text-center" style={{ color: i < 3 ? "#e94560" : "#444" }}>{i + 1}</span>
                      {p.headshot_url && <img src={p.headshot_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-white truncate block">{p.name}</span>
                        <div className="flex items-center gap-1">{t.logo_url && <img src={t.logo_url} alt="" className="w-3 h-3" />}<span style={{ fontSize: "10px", color: "#555" }}>{t.abbreviation}</span></div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold" style={{ color: "#52b788" }}>{fmt(p.points_per_game)}</div>
                        <div style={{ fontSize: "9px", color: "#555" }}>PPG</div>
                      </div>
                      <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: "rgba(82,183,136,0.1)", color: "#52b788", fontSize: "10px" }}>Check line →</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Selected player header */}
          <button onClick={() => setSelectedPlayer(null)} className="text-xs font-semibold mb-4 flex items-center gap-1" style={{ color: "#e94560" }}>← Pick different player</button>
          
          <div className="flex items-center gap-3 p-3 rounded-xl mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {selectedPlayer.headshot_url && <img src={selectedPlayer.headshot_url} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="text-base font-bold text-white truncate">{selectedPlayer.name}</div>
              <div className="flex items-center gap-1.5">
                {team.logo_url && <img src={team.logo_url} alt="" className="w-4 h-4" />}
                <span className="text-xs" style={{ color: "#888" }}>{team.full_name} · {selectedPlayer.position}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 flex-shrink-0">
              <div className="text-center"><div style={{ fontSize: "9px", color: "#555" }}>PTS</div><div className="text-sm font-bold text-white">{fmt(selectedPlayer.points_per_game)}</div></div>
              <div className="text-center"><div style={{ fontSize: "9px", color: "#555" }}>REB</div><div className="text-sm font-bold" style={{ color: "#aaa" }}>{fmt(selectedPlayer.rebounds_per_game)}</div></div>
              <div className="text-center"><div style={{ fontSize: "9px", color: "#555" }}>AST</div><div className="text-sm font-bold" style={{ color: "#aaa" }}>{fmt(selectedPlayer.assists_per_game)}</div></div>
            </div>
          </div>

          <LineCheck playerId={selectedPlayer.player_id || selectedPlayer.id} player={selectedPlayer} teamMap={teamMap} />
        </div>
      )}
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
  const { sharing, share: shareImg } = useShareImage();
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const compareParam = params.get("compare");
      if (!compareParam) return;
      const parts = compareParam.split(",").map((s) => decodeURIComponent(s.trim().toLowerCase()));
      if (parts.length !== 2) return;
      const found1 = playerStats.find((p) => p.name && p.name.toLowerCase() === parts[0]);
      const found2 = playerStats.find((p) => p.name && p.name.toLowerCase() === parts[1]);
      if (found1) { setP1(found1); setQ1(found1.name); }
      if (found2) { setP2(found2); setQ2(found2.name); }
    } catch {}
  }, [playerStats]);

  const updateUrl = (player1, player2) => {
    if (player1 && player2) {
      window.history.replaceState(null, "", window.location.pathname + "?compare=" + encodeURIComponent(player1.name) + "," + encodeURIComponent(player2.name));
    } else {
      window.history.replaceState(null, "", window.location.pathname);
    }
  };

  const search = (q) => {
    if (q.length < 2) return [];
    const lower = q.toLowerCase();
    return playerStats.filter((p) => p.name && p.name.toLowerCase().includes(lower)).slice(0, 6);
  };

  const r1 = useMemo(() => search(q1), [q1, playerStats]);
  const r2 = useMemo(() => search(q2), [q2, playerStats]);

  const pick = (setter, qSetter, showSetter) => (p) => {
    setter(p); qSetter(p.name); showSetter(false);
    // update url after state settles
    setTimeout(() => {
      const np1 = setter === setP1 ? p : p1;
      const np2 = setter === setP2 ? p : p2;
      updateUrl(np1, np2);
    }, 0);
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

  const handleCopyLink = () => {
    if (!p1 || !p2) return;
    const url = window.location.origin + window.location.pathname + "?compare=" + encodeURIComponent(p1.name) + "," + encodeURIComponent(p2.name);
    navigator.clipboard.writeText(url).then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }).catch(() => { prompt("Copy this link:", url); });
  };

  return (
    <div className="space-y-4">
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

      {p1 && p2 && (
        <div ref={cardRef} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
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
          {stats.map((st) => <CompareRow key={st.k} label={st.label} v1={p1[st.k]} v2={p2[st.k]} higherBetter={st.higherBetter !== false} />)}
          <div className="mt-3 flex items-center justify-between">
            <span style={{ fontSize: "10px", color: "#333", fontWeight: 700 }}>STATLINE</span>
            <span style={{ fontSize: "10px", color: "#444" }}>{p1.games_played} GP vs {p2.games_played} GP</span>
          </div>
        </div>
      )}

      {p1 && p2 && (
        <div className="flex justify-center gap-2">
          <ShareButton onClick={() => shareImg(cardRef, `statline-${p1.name}-vs-${p2.name}`)} sharing={sharing} label="📤 Share card" />
          <button onClick={handleCopyLink} className="px-4 py-2 rounded-xl text-xs font-bold transition-all" style={{ background: "rgba(255,255,255,0.06)", color: linkCopied ? "#52b788" : "#888" }}>
            {linkCopied ? "✓ Copied!" : "🔗 Copy link"}
          </button>
        </div>
      )}

      {!p1 && !p2 && (
        <div className="text-center py-8">
          <p className="text-sm" style={{ color: "#555" }}>Search for two players to compare stats head-to-head</p>
          <p className="text-xs mt-2" style={{ color: "#444" }}>Share via image or shareable link</p>
        </div>
      )}
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
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [navHistory, setNavHistory] = useState([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchAllNBAData();
      setData(result);
      const params = new URLSearchParams(window.location.search);
      if (params.get("compare")) setTab("Compare");
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Keyboard shortcut: Cmd/Ctrl+K to open search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const pushNav = (current) => setNavHistory((prev) => [...prev, current]);

  const handleSelectPlayer = (player) => {
    pushNav({ tab, selectedPlayer, selectedTeamId });
    setSelectedPlayer(player);
    setSelectedTeamId(null);
    setTab("_playerDetail");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectTeam = (teamId) => {
    pushNav({ tab, selectedPlayer, selectedTeamId });
    setSelectedTeamId(teamId);
    setSelectedPlayer(null);
    setTab("_teamPage");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBack = () => {
    const prev = navHistory[navHistory.length - 1];
    if (prev) {
      setNavHistory((h) => h.slice(0, -1));
      setTab(prev.tab);
      setSelectedPlayer(prev.selectedPlayer);
      setSelectedTeamId(prev.selectedTeamId);
    } else {
      setTab("Scores");
      setSelectedPlayer(null);
      setSelectedTeamId(null);
    }
  };

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen error={error} onRetry={loadData} />;

  return (
    <div className="min-h-screen" style={{ background: "#08080f", color: "#c8c8d0" }}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl" style={{ background: "rgba(8,8,15,0.92)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-3xl mx-auto px-4 pt-3 pb-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-black tracking-tight cursor-pointer" style={{ color: "#e94560", letterSpacing: "-0.5px" }} onClick={() => { setTab("Scores"); setSelectedPlayer(null); setSelectedTeamId(null); setNavHistory([]); }}>STATLINE</h1>
              <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
                {SPORTS.map((s) => (
                  <button key={s.id} onClick={() => s.active && setSport(s.id)} className="px-2 py-1 rounded-md text-xs font-bold transition-all" style={{
                    background: sport === s.id ? "rgba(233,69,96,0.15)" : "transparent",
                    color: sport === s.id ? s.color : s.active ? "#555" : "#333",
                    opacity: s.active ? 1 : 0.5,
                    cursor: s.active ? "pointer" : "default",
                  }}>{s.icon}</button>
                ))}
              </div>
            </div>
            <button onClick={() => setSearchOpen(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/5 transition-colors" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }} aria-label="Search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <span className="text-xs hidden sm:inline" style={{ color: "#555" }}>Search</span>
              <span className="text-xs hidden sm:inline px-1 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "#444", fontSize: "10px" }}>⌘K</span>
            </button>
          </div>

          <div className="flex gap-0.5 overflow-x-auto pb-0 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
            {TABS.map((t) => {
              const isActive = tab === t || (tab === "_playerDetail" && t === "Players") || (tab === "_teamPage" && (t === "Standings"));
              return (
                <button key={t} onClick={() => { setTab(t); setSelectedPlayer(null); setSelectedTeamId(null); setNavHistory([]); }} className="px-3.5 py-2 text-sm font-bold transition-all whitespace-nowrap relative" style={{ color: isActive ? "#e94560" : "#555" }}>
                  {t}
                  {isActive && <div className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full" style={{ background: "#e94560" }} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Search Overlay */}
      {searchOpen && (
        <SimpleSearch
          playerStats={data.playerStats}
          teamMap={data.teamMap}
          standings={data.standings}
          onSelectPlayer={handleSelectPlayer}
          onSelectTeam={handleSelectTeam}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-5">
        {tab === "Scores" && <ScoresView games={data.games} teamMap={data.teamMap} standingsMap={data.standingsMap} playerStats={data.enrichedStats} onSelectPlayer={handleSelectPlayer} onTeamClick={handleSelectTeam} />}
        {tab === "Schedule" && <ScheduleView upcomingGames={data.upcomingGames} teamMap={data.teamMap} standingsMap={data.standingsMap} onTeamClick={handleSelectTeam} />}
        {tab === "Standings" && <StandingsView east={data.east} west={data.west} teamMap={data.teamMap} standings={data.standings} onTeamClick={handleSelectTeam} />}
        {tab === "Players" && <PlayersView playerStats={data.enrichedStats} teamMap={data.teamMap} onSelectPlayer={handleSelectPlayer} />}
        {tab === "Lines" && <LinesTab playerStats={data.enrichedStats} teamMap={data.teamMap} />}
        {tab === "_playerDetail" && selectedPlayer && <PlayerDetail player={selectedPlayer} teamMap={data.teamMap} onBack={handleBack} onTeamClick={handleSelectTeam} />}
        {tab === "_teamPage" && selectedTeamId && <TeamPage teamId={selectedTeamId} teamMap={data.teamMap} standings={data.standings} playerStats={data.enrichedStats} games={data.games} allGames={data.allGames} upcomingGames={data.upcomingGames} teamRosters={data.teamRosters} onBack={handleBack} onSelectPlayer={handleSelectPlayer} onTeamClick={handleSelectTeam} />}
        {tab === "Compare" && <CompareView playerStats={data.enrichedStats} teamMap={data.teamMap} />}
      </div>

      <div className="text-center py-6 mt-8" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <p style={{ fontSize: "11px", color: "#333" }}>StatLine · Sports stats made simple</p>
      </div>
    </div>
  );
}
