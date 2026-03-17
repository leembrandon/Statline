import Link from "next/link";
import { query, supabase } from "@/lib/supabase";
import { fmt } from "@/lib/utils";

export const revalidate = 300;

export const metadata = {
  title: "NBA Standings — StatLine",
  description: "Current NBA standings by conference.",
};

async function getData() {
  const standings = await query("standings", { eq: { sport: "nba" }, order: { column: "conference_rank", ascending: true } });
  const teamIds = standings.map((s) => s.team_id);
  let teams = [];
  if (teamIds.length) {
    const { data } = await supabase.from("teams").select("*").in("id", teamIds);
    teams = data || [];
  }
  const teamMap = {};
  teams.forEach((t) => (teamMap[t.id] = t));
  return { standings, teamMap };
}

function ConferenceTable({ label, standings, teamMap }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      {/* Conference header */}
      <div className="px-3 sm:px-4 py-2.5" style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border)" }}>
        <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>{label}</span>
      </div>

      {/* Column headers */}
      <div className="flex items-center px-3 sm:px-4 py-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="text-[10px] font-semibold w-6 text-center flex-shrink-0" style={{ color: "var(--text-dim)" }}>#</span>
        <span className="text-[10px] font-semibold flex-1 pl-2" style={{ color: "var(--text-dim)" }}>Team</span>
        <span className="text-[10px] font-semibold w-9 text-center" style={{ color: "var(--text-dim)" }}>W</span>
        <span className="text-[10px] font-semibold w-9 text-center" style={{ color: "var(--text-dim)" }}>L</span>
        <span className="text-[10px] font-semibold w-12 text-center" style={{ color: "var(--text-dim)" }}>PCT</span>
        <span className="text-[10px] font-semibold w-10 text-center hidden sm:block" style={{ color: "var(--text-dim)" }}>GB</span>
        <span className="text-[10px] font-semibold w-10 text-center hidden md:block" style={{ color: "var(--text-dim)" }}>STRK</span>
        <span className="text-[10px] font-semibold w-12 text-center hidden md:block" style={{ color: "var(--text-dim)" }}>L10</span>
        <span className="text-[10px] font-semibold w-14 text-center hidden lg:block" style={{ color: "var(--text-dim)" }}>HOME</span>
        <span className="text-[10px] font-semibold w-14 text-center hidden lg:block" style={{ color: "var(--text-dim)" }}>AWAY</span>
        <span className="text-[10px] font-semibold w-14 text-center hidden xl:block" style={{ color: "var(--text-dim)" }}>CONF</span>
        <span className="text-[10px] font-semibold w-14 text-center hidden xl:block" style={{ color: "var(--text-dim)" }}>DIV</span>
      </div>

      {/* Rows */}
      {standings.map((s, i) => {
        const t = teamMap[s.team_id] || {};
        const rank = s.conference_rank || i + 1;
        return (
          <Link
            key={s.id}
            href={`/nba/teams/${t.espn_id || s.team_id}`}
            className="flex items-center px-3 sm:px-4 py-2.5 card-hover"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <span className="stat-num text-[11px] w-6 text-center font-bold flex-shrink-0" style={{ color: rank <= 6 ? "var(--accent)" : rank <= 10 ? "var(--green)" : "var(--text-dim)" }}>{rank}</span>
            <div className="flex items-center gap-2 flex-1 min-w-0 pl-2">
              {t.logo_url && <img src={t.logo_url} alt="" className="w-5 h-5 flex-shrink-0" />}
              <span className="text-[13px] font-semibold truncate sm:hidden" style={{ color: "var(--text-bright)" }}>{t.abbreviation || "?"}</span>
              <span className="text-[13px] font-semibold truncate hidden sm:inline" style={{ color: "var(--text-bright)" }}>{t.full_name || t.abbreviation || "?"}</span>
            </div>
            <span className="stat-num text-[12px] w-9 text-center font-semibold" style={{ color: "var(--text-bright)" }}>{s.wins}</span>
            <span className="stat-num text-[12px] w-9 text-center" style={{ color: "var(--text-dim)" }}>{s.losses}</span>
            <span className="stat-num text-[12px] w-12 text-center font-semibold" style={{ color: s.pct >= 0.6 ? "var(--green)" : s.pct < 0.4 ? "var(--red)" : "var(--text)" }}>{fmt(s.pct, 3)}</span>
            <span className="stat-num text-[11px] w-10 text-center hidden sm:block" style={{ color: "var(--text-dim)" }}>{s.games_back != null ? (s.games_back === 0 ? "—" : s.games_back) : "-"}</span>
            <span className="stat-num text-[11px] w-10 text-center hidden md:block" style={{ color: s.streak?.startsWith("W") ? "var(--green)" : s.streak?.startsWith("L") ? "var(--red)" : "var(--text-dim)" }}>{s.streak || "-"}</span>
            <span className="stat-num text-[11px] w-12 text-center hidden md:block" style={{ color: "var(--text-dim)" }}>{s.last_10 || "-"}</span>
            <span className="stat-num text-[11px] w-14 text-center hidden lg:block" style={{ color: "var(--text-dim)" }}>{s.home_record || "-"}</span>
            <span className="stat-num text-[11px] w-14 text-center hidden lg:block" style={{ color: "var(--text-dim)" }}>{s.away_record || "-"}</span>
            <span className="stat-num text-[11px] w-14 text-center hidden xl:block" style={{ color: "var(--text-dim)" }}>{s.conf_record || "-"}</span>
            <span className="stat-num text-[11px] w-14 text-center hidden xl:block" style={{ color: "var(--text-dim)" }}>{s.div_record || "-"}</span>
          </Link>
        );
      })}

      <div className="flex items-center gap-4 px-3 sm:px-4 py-2" style={{ background: "rgba(255,255,255,0.01)" }}>
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
  );
}

export default async function NBAStandings() {
  const { standings, teamMap } = await getData();
  const east = standings.filter((s) => teamMap[s.team_id]?.conference?.toLowerCase().includes("east"));
  const west = standings.filter((s) => teamMap[s.team_id]?.conference?.toLowerCase().includes("west"));

  return (
    <div>
      <Link href="/nba" className="text-[12px] font-semibold mb-3 inline-block" style={{ color: "var(--accent)" }}>← NBA</Link>
      <h1 className="text-[24px] sm:text-[28px] font-extrabold mb-5" style={{ color: "var(--text-bright)" }}>Standings</h1>
      <div className="space-y-4">
        <ConferenceTable label="Eastern Conference" standings={east} teamMap={teamMap} />
        <ConferenceTable label="Western Conference" standings={west} teamMap={teamMap} />
      </div>
      {standings.length === 0 && (
        <div className="text-center py-16" style={{ color: "var(--text-dim)" }}>
          <p>No standings data. Run the sync script.</p>
        </div>
      )}
    </div>
  );
}
