// Format a number to fixed decimal places
export function fmt(val, decimals = 1) {
  if (val == null) return "-";
  return Number(val).toFixed(decimals);
}

// Format percentage
export function pct(val) {
  if (val == null) return "-";
  // Handle both 0-1 and 0-100 scales
  const v = Number(val);
  if (v <= 1 && v >= 0) return (v * 100).toFixed(1) + "%";
  return v.toFixed(1) + "%";
}

// Get record string
export function record(wins, losses, ties) {
  if (ties) return `${wins}-${losses}-${ties}`;
  return `${wins}-${losses}`;
}

// Format date for display
export function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// Format time for display
export function formatTime(dateStr) {
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

// Sport config
export const SPORTS = {
  nba: {
    name: "NBA",
    color: "#c9082a",
    icon: "🏀",
    slug: "nba",
  },
  nfl: {
    name: "NFL",
    color: "#013369",
    icon: "🏈",
    slug: "nfl",
  },
  mlb: {
    name: "MLB",
    color: "#002d72",
    icon: "⚾",
    slug: "mlb",
  },
};
