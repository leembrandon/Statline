import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fmt } from "@/lib/utils";

export const revalidate = 300;

async function getPlayer(espnId) {
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("espn_id", parseInt(espnId))
    .eq("sport", "nba")
    .limit(1);

  if (!players || players.length === 0) return null;
  const player = players[0];

  const [{ data: stats }, { data: career }, { data: team }] = await Promise.all([
    supabase.from("nba_player_stats").select("*").eq("player_id", player.id).limit(1),
    supabase.from("nba_career_stats").select("*").eq("player_id", player.id).limit(1),
    supabase.from("teams").select("*").eq("id", player.team_id).limit(1),
  ]);

  return { player, stats: stats?.[0] || null, career: career?.[0] || null, team: team?.[0] || null };
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const data = await getPlayer(id);
  if (!data) return { title: "Player Not Found — StatLine" };
  return {
    title: `${data.player.name} Stats — StatLine`,
    description: `${data.player.name} NBA stats, season averages, and career numbers.`,
  };
}

function StatBox({ label, value, highlight, large }) {
  return (
    <div className="text-center rounded-xl py-3 px-2" style={{ background: "rgba(255,255,255,0.025)" }}>
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-dim)" }}>{label}</div>
      <div className={`stat-num ${large ? "text-[22px] sm:text-[26px]" : "text-[17px] sm:text-[19px]"}`} style={{ color: highlight ? "var(--text-bright)" : "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}

export default async function PlayerPage({ params }) {
  const { id } = await params;
  const data = await getPlayer(id);

  if (!data) {
    return (
      <div className="text-center py-16">
        <p className="text-base mb-3" style={{ color: "var(--text-bright)" }}>Player not found</p>
        <Link href="/nba/players" className="text-[13px] font-semibold" style={{ color: "var(--accent)" }}>← Back to players</Link>
      </div>
    );
  }

  const { player, stats, career, team } = data;
  const teamColor = team?.color || "var(--accent)";

  return (
    <div className="max-w-4xl">
      <Link href="/nba/players" className="text-[12px] font-semibold mb-3 inline-block" style={{ color: "var(--accent)" }}>← Players</Link>

      {/* Hero */}
      <div className="rounded-2xl p-4 sm:p-6 mb-6 overflow-hidden relative" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: teamColor }} />
        <div className="flex items-start gap-4 sm:gap-6 mt-1">
          {player.headshot_url ? (
            <img src={player.headshot_url} alt={player.name} className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover flex-shrink-0" style={{ background: "var(--bg-surface)" }} />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex-shrink-0" style={{ background: "var(--bg-surface)" }} />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-[22px] sm:text-[28px] font-extrabold leading-tight truncate" style={{ color: "var(--text-bright)" }}>{player.name}</h1>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {team && (
                <div className="flex items-center gap-1.5">
                  {team.logo_url && <img src={team.logo_url} alt="" className="w-4 h-4" />}
                  <span className="text-[12px] sm:text-[13px] font-semibold" style={{ color: "var(--text)" }}>{team.full_name}</span>
                </div>
              )}
              <span className="pill" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-dim)" }}>{player.position}</span>
              {player.jersey_number && <span className="text-[12px] font-semibold" style={{ color: "var(--text-dim)" }}>#{player.jersey_number}</span>}
            </div>
            <div className="flex gap-3 mt-2">
              {player.height && <span className="text-[11px] sm:text-[12px]" style={{ color: "var(--text-dim)" }}>{player.height}</span>}
              {player.weight && <span className="text-[11px] sm:text-[12px]" style={{ color: "var(--text-dim)" }}>{player.weight}</span>}
              {player.age && <span className="text-[11px] sm:text-[12px]" style={{ color: "var(--text-dim)" }}>{player.age} yrs</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Season Stats */}
      {stats && (
        <section className="mb-6">
          <h2 className="text-[16px] font-bold mb-3" style={{ color: "var(--text-bright)" }}>Season Averages</h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
            <StatBox label="PTS" value={fmt(stats.points_per_game, 1)} highlight large />
            <StatBox label="REB" value={fmt(stats.rebounds_per_game, 1)} highlight large />
            <StatBox label="AST" value={fmt(stats.assists_per_game, 1)} highlight large />
            <StatBox label="STL" value={fmt(stats.steals_per_game, 1)} />
            <StatBox label="BLK" value={fmt(stats.blocks_per_game, 1)} />
            <StatBox label="TO" value={fmt(stats.turnovers_per_game, 1)} />
          </div>

          <h3 className="text-[13px] font-bold mb-2" style={{ color: "var(--text-bright)" }}>Shooting</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
            <StatBox label="FG%" value={fmt(stats.fg_pct, 1)} highlight />
            <StatBox label="3P%" value={fmt(stats.fg3_pct, 1)} highlight />
            <StatBox label="FT%" value={fmt(stats.ft_pct, 1)} highlight />
            <StatBox label="MIN" value={fmt(stats.minutes_per_game, 1)} />
          </div>

          <div className="text-[11px] mt-3" style={{ color: "var(--text-dim)" }}>
            {stats.games_played} games played{stats.games_started ? ` · ${stats.games_started} started` : ""}
          </div>
        </section>
      )}

      {/* Career Stats */}
      {career && (
        <section className="mb-6">
          <h2 className="text-[16px] font-bold mb-3" style={{ color: "var(--text-bright)" }}>Career Averages</h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
            <StatBox label="PTS" value={fmt(career.points_per_game, 1)} highlight large />
            <StatBox label="REB" value={fmt(career.rebounds_per_game, 1)} highlight large />
            <StatBox label="AST" value={fmt(career.assists_per_game, 1)} highlight large />
            <StatBox label="STL" value={fmt(career.steals_per_game, 1)} />
            <StatBox label="BLK" value={fmt(career.blocks_per_game, 1)} />
            <StatBox label="FG%" value={fmt(career.fg_pct, 1)} />
          </div>

          {(career.double_doubles != null || career.triple_doubles != null) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {career.double_doubles != null && <StatBox label="DD2" value={career.double_doubles} />}
              {career.triple_doubles != null && <StatBox label="TD3" value={career.triple_doubles} />}
              {career.fg3_pct != null && <StatBox label="3P%" value={fmt(career.fg3_pct, 1)} />}
              {career.ft_pct != null && <StatBox label="FT%" value={fmt(career.ft_pct, 1)} />}
            </div>
          )}

          <div className="text-[11px] mt-3" style={{ color: "var(--text-dim)" }}>
            {career.games_played} career games{career.games_started ? ` · ${career.games_started} started` : ""}
          </div>
        </section>
      )}

      {!stats && !career && (
        <div className="text-center py-12" style={{ color: "var(--text-dim)" }}>
          <p>No stats available for this player.</p>
        </div>
      )}
    </div>
  );
}
