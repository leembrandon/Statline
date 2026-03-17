"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://snucfaofcihjazipvird.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNudWNmYW9mY2loamF6aXB2aXJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2ODYzODEsImV4cCI6MjA4OTI2MjM4MX0.nEjx1Lx4i2oruPajbrKwILX5AK1PBfmMqx5PaCL--nQ"
);

export default function PlayerSearch({ collapsed = false }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const ref = useRef(null);
  const debounceRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("players")
          .select("id, espn_id, name, position, team_id, headshot_url, sport")
          .ilike("name", `%${val}%`)
          .limit(8);
        setResults(data || []);
        setOpen(true);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 250);
  }

  function handleSelect(player) {
    setQuery("");
    setResults([]);
    setOpen(false);
    const sport = player.sport || "nba";
    router.push(`/${sport}/players/${player.espn_id}`);
  }

  return (
    <div ref={ref} className="relative" style={{ width: collapsed ? "auto" : "100%" }}>
      <div className="relative">
        {/* Search icon */}
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "var(--text-dim)" }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search players..."
          className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none transition-colors"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border)",
            color: "var(--text-bright)",
            fontSize: "13px",
          }}
        />
        {loading && (
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
          />
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 rounded-xl overflow-hidden z-50 shadow-2xl"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-bright)",
          }}
        >
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelect(p)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
              style={{ borderBottom: "1px solid var(--border)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--bg-card-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
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
                  {p.name}
                </div>
                <div className="text-[11px]" style={{ color: "var(--text-dim)" }}>
                  {p.position}
                  {p.team_id ? ` · ${p.team_id.replace("nba_", "").toUpperCase()}` : ""}
                </div>
              </div>
              <span
                className="pill flex-shrink-0"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: "var(--text-dim)",
                  fontSize: "10px",
                }}
              >
                {(p.sport || "nba").toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && results.length === 0 && query.length >= 2 && !loading && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 rounded-xl p-4 text-center z-50"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-bright)",
          }}
        >
          <p className="text-[13px]" style={{ color: "var(--text-dim)" }}>
            No players found for &ldquo;{query}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
