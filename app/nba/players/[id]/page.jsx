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

  const { data: stats } = await supabase
    .from("nba_player_stats")
    .select("*")
    .eq("player_id", player.id)
    .limit(1);

  const { data: team } = await supabase
    .from("teams")
    .select("*")
    .eq("id", player.team_id)
    .limit(1);

  return { player, stats: stats?.[0] || null, team: team?.[0] || null };
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const data = await getPlayer(id);
  if (!data) return { title: "Player Not Found — StatLine" };
  return {
    title: `${data.player.name} Stats — StatLine`,
    description: `${data.player.name} NBA stats, season averages, and more.`,
  };
}

function StatBox({ label, value, highlight }) {
  return (
    <div className="text-center p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
      <div className="text-xs mb-1" style={{ color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div className={`text-xl font-bold ${highlight ? "text-white" : ""}`}>{value}</div>
    </div>
  );
}

export default async function PlayerPage({ params }) {
  const { id } = await params;
  const data = await getPlayer(id);

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-white mb-2">Player not found</p>
        <Link href="/nba/players" className="text-sm" style={{ color: "var(--accent)" }}>← Back to players</Link>
      </div>
    );
  }

  const { player, stats, team } = data;

  return (
    <div>
      <Link href="/nba/players" className="text-xs mb-4 inline-block" style={{ color: "var(--accent)" }}>← Players</Link>

      {/* Player hero */}
      <div className="rounded-xl p-4 mb-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-4">
          {player.headshot_url && (
            <img src={player.headshot_url} alt={player.name} className="w-20 h-20 rounded-full object-cover" />
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-black text-white">{player.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {team && (
                <div className="flex items-center gap-1.5">
                  {team.logo_url && <img src={team.logo_url} alt="" className="w-4 h-4" />}
                  <span className="text-sm" style={{ color: "var(--text-dim)" }}>{team.full_name}</span>
                </div>
              )}
              <span className="text-sm px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-dim)" }}>{player.position}</span>
              {player.jersey_number && <span className="text-sm" style={{ color: "var(--text-dim)" }}>#{player.jersey_number}</span>}
            </div>
            <div className="flex gap-3 mt-2 text-xs" style={{ color: "var(--text-dim)" }}>
              {player.height && <span>{player.height}</span>}
              {player.weight && <span>{player.weight}</span>}
              {player.age && <span>{player.age} yrs</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Season stats */}
      {stats && (
        <div>
          <h2 className="text-lg font-bold text-white mb-3">Season Averages</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-4">
            <StatBox label="PTS" value={fmt(stats.points_per_game, 1)} highlight />
            <StatBox label="REB" value={fmt(stats.rebounds_per_game, 1)} highlight />
            <StatBox label="AST" value={fmt(stats.assists_per_game, 1)} highlight />
            <StatBox label="STL" value={fmt(stats.steals_per_game, 1)} />
            <StatBox label="BLK" value={fmt(stats.blocks_per_game, 1)} />
            <StatBox label="TO" value={fmt(stats.turnovers_per_game, 1)} />
          </div>

          <h2 className="text-lg font-bold text-white mb-3">Shooting</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
            <StatBox label="FG%" value={fmt(stats.fg_pct, 1)} />
            <StatBox label="3P%" value={fmt(stats.fg3_pct, 1)} />
            <StatBox label="FT%" value={fmt(stats.ft_pct, 1)} />
            <StatBox label="MIN" value={fmt(stats.minutes_per_game, 1)} />
          </div>

          <div className="text-xs mt-4" style={{ color: "var(--text-dim)" }}>
            {stats.games_played} games played · {stats.games_started} games started
          </div>
        </div>
      )}

      {!stats && (
        <div className="text-center py-8 opacity-40">
          <p>No season stats available for this player.</p>
        </div>
      )}
    </div>
  );
}
