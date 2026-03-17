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
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="px-4 py-3" style={{ background: "rgba(255,255,255,0.03)" }}>
        <span className="text-sm font-bold text-white uppercase tracking-wider">{label}</span>
      </div>
      <div className="px-4 py-2 grid items-center" style={{ gridTemplateColumns: "28px 1fr 44px 44px 52px 56px 56px 56px", borderBottom: "1px solid var(--border)" }}>
        <span className="text-xs" style={{ color: "var(--text-dim)" }}>#</span>
        <span className="text-xs" style={{ color: "var(--text-dim)" }}>Team</span>
        <span className="text-xs text-center" style={{ color: "var(--text-dim)" }}>W</span>
        <span className="text-xs text-center" style={{ color: "var(--text-dim)" }}>L</span>
        <span className="text-xs text-center" style={{ color: "var(--text-dim)" }}>PCT</span>
        <span className="text-xs text-center hidden sm:block" style={{ color: "var(--text-dim)" }}>STRK</span>
        <span className="text-xs text-center hidden sm:block" style={{ color: "var(--text-dim)" }}>HOME</span>
        <span className="text-xs text-center hidden sm:block" style={{ color: "var(--text-dim)" }}>AWAY</span>
      </div>
      {standings.map((s, i) => {
        const t = teamMap[s.team_id] || {};
        const isPlayoff = (s.conference_rank || i + 1) <= 10;
        return (
          <Link key={s.id} href={`/nba/teams/${t.espn_id}`} className="block hover:bg-white/3">
            <div className="px-4 py-2.5 grid items-center" style={{ gridTemplateColumns: "28px 1fr 44px 44px 52px 56px 56px 56px", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
              <span className="text-xs font-bold" style={{ color: (s.conference_rank || i + 1) <= 6 ? "var(--accent)" : isPlayoff ? "var(--green)" : "var(--text-dim)" }}>{s.conference_rank || i + 1}</span>
              <div className="flex items-center gap-2 min-w-0">
                {t.logo_url && <img src={t.logo_url} alt="" className="w-5 h-5 flex-shrink-0" />}
                <span className="text-sm font-semibold text-white truncate">{t.full_name || t.abbreviation || "?"}</span>
              </div>
              <span className="text-sm text-center font-semibold">{s.wins}</span>
              <span className="text-sm text-center">{s.losses}</span>
              <span className="text-sm text-center font-semibold" style={{ color: s.pct >= 0.6 ? "var(--green)" : s.pct < 0.4 ? "var(--red)" : "inherit" }}>{fmt(s.pct, 3)}</span>
              <span className="text-xs text-center hidden sm:block" style={{ color: s.streak?.startsWith("W") ? "var(--green)" : s.streak?.startsWith("L") ? "var(--red)" : "inherit" }}>{s.streak || "-"}</span>
              <span className="text-xs text-center hidden sm:block">{s.home_record || "-"}</span>
              <span className="text-xs text-center hidden sm:block">{s.away_record || "-"}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default async function NBAStandings() {
  const { standings, teamMap } = await getData();

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
      <Link href="/nba" className="text-xs mb-4 inline-block" style={{ color: "var(--accent)" }}>← NBA</Link>
      <h1 className="text-xl font-black text-white mb-6">NBA Standings</h1>

      <div className="space-y-6">
        <ConferenceTable label="Eastern Conference" standings={east} teamMap={teamMap} />
        <ConferenceTable label="Western Conference" standings={west} teamMap={teamMap} />
      </div>

      {standings.length === 0 && (
        <div className="text-center py-12 opacity-40">
          <p>No standings data. Run the sync script.</p>
        </div>
      )}
    </div>
  );
}
