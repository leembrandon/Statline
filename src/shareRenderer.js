/**
 * shareRenderer.js
 *
 * Pure Canvas-API card renderer for StatLine share images.
 * Every pixel is drawn with ctx.fillRect / fillText / drawImage — no DOM
 * serialisation, no foreignObject, no html2canvas.
 *
 * ADDING A NEW SPORT
 * ──────────────────
 * Card functions (renderPlayerCard, renderTeamCard, …) accept a plain data
 * object. The caller assembles whatever fields its sport uses. The renderer
 * doesn't know or care whether the data came from NBA, NFL, or MLB — it
 * just draws the rows you give it.
 *
 * EXPORTS
 * ──────
 *  • renderPlayerCard(data)   → Promise<Canvas>
 *  • renderTeamCard(data)     → Promise<Canvas>
 *  • renderLineCard(data)     → Promise<Canvas>
 *  • renderCompareCard(data)  → Promise<Canvas>
 *  • shareCanvas(canvas, filename, shareUrl?)  — trigger download / native share
 */

/* ─── constants ─── */
const SCALE = 2;
const CARD_W = 440;
const PAD = 24;
const CONTENT_W = CARD_W - PAD * 2;
const BG = "#08080f";
const CARD_BG = "#111119";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const ACCENT = "#e94560";
const WHITE = "#ffffff";
const DIM = "#888888";
const FAINT = "#555555";
const MUTED = "#444444";
const GREEN = "#52b788";
const RED = "#ff6b6b";
const YELLOW = "#ffd166";
const BRAND = "#333333";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/* ─── low-level drawing primitives ─── */

function createCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w * SCALE;
  c.height = h * SCALE;
  const ctx = c.getContext("2d");
  ctx.scale(SCALE, SCALE);
  return { canvas: c, ctx };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
}

function strokeRoundRect(ctx, x, y, w, h, r, color, lineWidth = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
}

function drawText(ctx, text, x, y, { font = `14px ${FONT}`, color = WHITE, align = "left", maxWidth } = {}) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  if (maxWidth) {
    // truncate with ellipsis
    let t = String(text);
    while (ctx.measureText(t).width > maxWidth && t.length > 1) {
      t = t.slice(0, -1);
    }
    if (t !== String(text)) t += "…";
    ctx.fillText(t, x, y);
  } else {
    ctx.fillText(String(text), x, y);
  }
}

function measureText(ctx, text, font) {
  ctx.font = font;
  return ctx.measureText(String(text)).width;
}

function drawLine(ctx, x1, y1, x2, y2, color = "rgba(255,255,255,0.04)", width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/* load & cache an image */
const _imgCache = {};
async function loadImg(url) {
  if (!url) return null;
  if (_imgCache[url]) return _imgCache[url];
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    _imgCache[url] = bmp;
    return bmp;
  } catch {
    return null;
  }
}

function drawCircleImg(ctx, img, cx, cy, r) {
  if (!img) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

function drawSquareImg(ctx, img, x, y, size) {
  if (!img) return;
  ctx.drawImage(img, x, y, size, size);
}

/* ─── reusable card components ─── */

/**
 * Draw a grid of stat boxes.
 * boxes: [{ label, value, highlight? }]
 * cols:  how many columns
 * returns the Y after the last row
 */
function drawStatGrid(ctx, x, y, w, cols, boxes, gap = 6) {
  const boxW = (w - gap * (cols - 1)) / cols;
  const boxH = 44;
  const r = 8;

  boxes.forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const bx = x + col * (boxW + gap);
    const by = y + row * (boxH + gap);

    fillRoundRect(ctx, bx, by, boxW, boxH, r, "rgba(255,255,255,0.03)");

    // label
    drawText(ctx, b.label, bx + boxW / 2, by + 8, {
      font: `600 9px ${FONT}`, color: FAINT, align: "center",
    });
    // value
    drawText(ctx, b.value ?? "—", bx + boxW / 2, by + 22, {
      font: `700 ${b.highlight ? "17px" : "13px"} ${FONT}`,
      color: b.highlight ? WHITE : "#c8c8d0",
      align: "center",
    });
  });

  const rows = Math.ceil(boxes.length / cols);
  return y + rows * (boxH + gap) - gap;
}

/** Draw a section label like "Season averages" */
function drawSectionLabel(ctx, text, x, y, color = ACCENT) {
  drawText(ctx, text.toUpperCase(), x, y, {
    font: `700 10px ${FONT}`, color,
  });
  return y + 18;
}

/** Draw the STATLINE branding at the bottom */
function drawBranding(ctx, y, rightAlign = true) {
  const x = rightAlign ? CARD_W - PAD : PAD;
  const align = rightAlign ? "right" : "left";
  drawText(ctx, "STATLINE", x, y, {
    font: `700 10px ${FONT}`, color: BRAND, align,
  });
  return y + 16;
}

function fmt(val, dec = 1) {
  if (val == null || val === "") return "—";
  return Number(val).toFixed(dec);
}

/* ─── PLAYER CARD ─── */
/**
 * data: {
 *   name, position, jerseyNumber?, height?, weight?, age?,
 *   headshotUrl?, teamLogoUrl?, teamName?,
 *   gamesPlayed?,
 *   mainStats:  [{ label, value, highlight? }],   // e.g. PTS / REB / AST …
 *   extraStats: [{ label, value }],                // e.g. FG% / 3P% …
 *   extraLabel?: string,                           // e.g. "Shooting"
 *   accentColor?: string,
 * }
 */
export async function renderPlayerCard(data) {
  const accent = data.accentColor || ACCENT;

  // pre-load images
  const [headshot, logo] = await Promise.all([
    loadImg(data.headshotUrl),
    loadImg(data.teamLogoUrl),
  ]);

  /* measure height */
  const mainCols = Math.min(data.mainStats.length, 6);
  const mainRows = Math.ceil(data.mainStats.length / mainCols);
  const extraCols = data.extraStats ? Math.min(data.extraStats.length, 4) : 0;
  const extraRows = data.extraStats ? Math.ceil(data.extraStats.length / extraCols) : 0;

  let h = PAD; // top
  h += 64;     // header (name row)
  h += 8;      // gap
  h += 18;     // section label
  h += mainRows * 50; // stat boxes
  if (data.extraStats && data.extraStats.length) {
    h += 12;   // gap
    h += 18;   // section label
    h += extraRows * 50;
  }
  h += 12;     // gap
  h += 16;     // branding + games played
  h += PAD;    // bottom

  const { canvas, ctx } = createCanvas(CARD_W, h);

  // background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CARD_W, h);
  fillRoundRect(ctx, 0, 0, CARD_W, h, 14, CARD_BG);
  strokeRoundRect(ctx, 0, 0, CARD_W, h, 14, CARD_BORDER);

  let cy = PAD;

  // ── header row ──
  const imgSize = 56;
  if (headshot) drawCircleImg(ctx, headshot, PAD + imgSize / 2, cy + imgSize / 2, imgSize / 2);
  const textX = PAD + (headshot ? imgSize + 14 : 0);

  drawText(ctx, data.name, textX, cy, {
    font: `900 20px ${FONT}`, color: WHITE, maxWidth: CARD_W - textX - PAD,
  });

  // team + position row
  let tx = textX;
  if (logo) { drawSquareImg(ctx, logo, tx, cy + 26, 14); tx += 18; }
  if (data.teamName) {
    drawText(ctx, data.teamName, tx, cy + 27, { font: `500 12px ${FONT}`, color: DIM });
    tx += measureText(ctx, data.teamName, `500 12px ${FONT}`) + 8;
  }
  if (data.position) {
    fillRoundRect(ctx, tx, cy + 25, measureText(ctx, data.position, `600 10px ${FONT}`) + 10, 16, 4, "rgba(255,255,255,0.08)");
    drawText(ctx, data.position, tx + 5, cy + 28, { font: `600 10px ${FONT}`, color: DIM });
    tx += measureText(ctx, data.position, `600 10px ${FONT}`) + 18;
  }
  if (data.jerseyNumber) {
    drawText(ctx, `#${data.jerseyNumber}`, tx, cy + 27, { font: `500 12px ${FONT}`, color: FAINT });
  }

  // bio line
  const bioItems = [data.height, data.weight, data.age ? `${data.age} yrs` : null].filter(Boolean);
  if (bioItems.length) {
    drawText(ctx, bioItems.join("  ·  "), textX, cy + 46, { font: `400 11px ${FONT}`, color: FAINT });
  }

  cy += 64 + 8;

  // ── main stats ──
  cy = drawSectionLabel(ctx, "Season averages", PAD, cy, accent);
  cy = drawStatGrid(ctx, PAD, cy, CONTENT_W, mainCols, data.mainStats) + 6;

  // ── extra stats ──
  if (data.extraStats && data.extraStats.length) {
    cy += 6;
    cy = drawSectionLabel(ctx, data.extraLabel || "Shooting", PAD, cy, accent);
    cy = drawStatGrid(ctx, PAD, cy, CONTENT_W, extraCols, data.extraStats) + 6;
  }

  // ── footer ──
  cy += 6;
  if (data.gamesPlayed != null) {
    drawText(ctx, `${data.gamesPlayed} games played`, PAD, cy, { font: `400 11px ${FONT}`, color: FAINT });
  }
  drawBranding(ctx, cy);

  return canvas;
}

/* ─── TEAM CARD ─── */
/**
 * data: {
 *   name, conference?, division?,
 *   logoUrl?,
 *   stats:  [{ label, value, highlight? }],   // Record, Conf rank, Win%, Streak
 *   stats2?: [{ label, value }],              // Home, Away
 *   accentColor?,
 * }
 */
export async function renderTeamCard(data) {
  const accent = data.accentColor || ACCENT;
  const logo = await loadImg(data.logoUrl);

  const cols1 = Math.min(data.stats.length, 4);
  const rows1 = Math.ceil(data.stats.length / cols1);
  const cols2 = data.stats2 ? Math.min(data.stats2.length, 4) : 0;
  const rows2 = data.stats2 ? Math.ceil(data.stats2.length / cols2) : 0;

  let h = PAD;
  h += 56;               // header
  h += 10;               // gap
  h += rows1 * 50;       // stats row 1
  if (data.stats2?.length) h += 6 + rows2 * 50;
  h += 14;               // gap
  h += 16;               // branding
  h += PAD;

  const { canvas, ctx } = createCanvas(CARD_W, h);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CARD_W, h);
  fillRoundRect(ctx, 0, 0, CARD_W, h, 14, CARD_BG);
  strokeRoundRect(ctx, 0, 0, CARD_W, h, 14, CARD_BORDER);

  let cy = PAD;

  // header
  const logoSize = 48;
  if (logo) drawSquareImg(ctx, logo, PAD, cy, logoSize);
  const textX = PAD + (logo ? logoSize + 14 : 0);
  drawText(ctx, data.name, textX, cy + 4, {
    font: `900 22px ${FONT}`, color: WHITE, maxWidth: CARD_W - textX - PAD,
  });
  const subParts = [data.conference, data.division].filter(Boolean).join("  ·  ");
  if (subParts) {
    drawText(ctx, subParts, textX, cy + 32, { font: `400 12px ${FONT}`, color: DIM });
  }

  cy += 56 + 10;
  cy = drawStatGrid(ctx, PAD, cy, CONTENT_W, cols1, data.stats) + 6;
  if (data.stats2?.length) {
    cy = drawStatGrid(ctx, PAD, cy, CONTENT_W, cols2, data.stats2) + 6;
  }

  cy += 8;
  drawBranding(ctx, cy);

  return canvas;
}

/* ─── LINE CHECK CARD ─── */
/**
 * data: {
 *   playerName, position?, headshotUrl?, teamLogoUrl?, teamAbbr?,
 *   direction,            // "over" | "under"
 *   threshold: number,
 *   statLabel: string,    // "Points", "Rebounds" …
 *   games: [{ value, oppAbbr, hit }],
 *   hits, total, hitPct,
 *   seasonAvg?,
 *   accentColor?,
 * }
 */
export async function renderLineCard(data) {
  const pctColor = data.hitPct >= 60 ? GREEN : data.hitPct >= 40 ? YELLOW : RED;

  const [headshot, logo] = await Promise.all([
    loadImg(data.headshotUrl),
    loadImg(data.teamLogoUrl),
  ]);

  const gamesPerRow = Math.min(data.games.length, 12);
  const gameRows = Math.ceil(data.games.length / gamesPerRow);

  let h = PAD;
  h += 44;               // player header
  h += 8;                // divider gap
  h += 50;               // line info + fraction
  h += 10;               // gap
  h += gameRows * 42;    // game dots
  h += 8;                // gap
  h += 16;               // branding footer
  h += PAD;

  const { canvas, ctx } = createCanvas(CARD_W, h);

  // background — tinted by hit percentage
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CARD_W, h);
  const tint = data.hitPct >= 60 ? "rgba(82,183,136,0.06)" : data.hitPct >= 40 ? "rgba(255,209,102,0.06)" : "rgba(255,107,107,0.06)";
  fillRoundRect(ctx, 0, 0, CARD_W, h, 14, CARD_BG);
  fillRoundRect(ctx, 0, 0, CARD_W, h, 14, tint);
  const borderTint = data.hitPct >= 60 ? "rgba(82,183,136,0.2)" : data.hitPct >= 40 ? "rgba(255,209,102,0.2)" : "rgba(255,107,107,0.2)";
  strokeRoundRect(ctx, 0, 0, CARD_W, h, 14, borderTint);

  let cy = PAD;

  // player header
  if (headshot) drawCircleImg(ctx, headshot, PAD + 18, cy + 18, 18);
  const tx0 = PAD + (headshot ? 44 : 0);
  drawText(ctx, data.playerName, tx0, cy + 4, { font: `700 14px ${FONT}`, color: WHITE, maxWidth: CARD_W - tx0 - PAD });
  let lx = tx0;
  if (logo) { drawSquareImg(ctx, logo, lx, cy + 24, 12); lx += 16; }
  drawText(ctx, [data.teamAbbr, data.position].filter(Boolean).join(" · "), lx, cy + 24, {
    font: `400 11px ${FONT}`, color: FAINT,
  });
  cy += 44;

  drawLine(ctx, PAD, cy, CARD_W - PAD, cy, "rgba(255,255,255,0.06)");
  cy += 8;

  // direction / threshold label
  drawText(ctx, `${data.direction} ${data.threshold} ${data.statLabel}`.toUpperCase(), PAD, cy + 2, {
    font: `700 14px ${FONT}`, color: pctColor,
  });
  drawText(ctx, `Last ${data.total} games`, PAD, cy + 22, {
    font: `400 11px ${FONT}`, color: FAINT,
  });

  // fraction + pct on right
  drawText(ctx, `${data.hits}/${data.total}`, CARD_W - PAD, cy, {
    font: `900 28px ${FONT}`, color: pctColor, align: "right",
  });
  drawText(ctx, `${data.hitPct.toFixed(0)}%`, CARD_W - PAD, cy + 32, {
    font: `700 13px ${FONT}`, color: pctColor, align: "right",
  });
  cy += 50 + 10;

  // game dots
  const dotSize = 26;
  const dotGap = 6;
  const totalDotsW = gamesPerRow * dotSize + (gamesPerRow - 1) * dotGap;
  const dotsX = PAD + (CONTENT_W - totalDotsW) / 2;

  data.games.forEach((g, i) => {
    const col = i % gamesPerRow;
    const row = Math.floor(i / gamesPerRow);
    const dx = dotsX + col * (dotSize + dotGap);
    const dy = cy + row * 42;
    const cxDot = dx + dotSize / 2;
    const cyDot = dy + dotSize / 2;

    // circle
    ctx.beginPath();
    ctx.arc(cxDot, cyDot, dotSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = g.hit ? "rgba(82,183,136,0.2)" : "rgba(255,107,107,0.15)";
    ctx.fill();

    // value
    drawText(ctx, String(g.value), cxDot, cyDot - 5, {
      font: `700 10px ${FONT}`, color: g.hit ? GREEN : RED, align: "center",
    });

    // opp label
    if (g.oppAbbr) {
      drawText(ctx, g.oppAbbr, cxDot, dy + dotSize + 2, {
        font: `400 7px ${FONT}`, color: MUTED, align: "center",
      });
    }
  });

  cy += gameRows * 42 + 8;

  // footer
  drawLine(ctx, PAD, cy - 4, CARD_W - PAD, cy - 4, "rgba(255,255,255,0.04)");
  drawText(ctx, "STATLINE", PAD, cy, { font: `700 10px ${FONT}`, color: BRAND });
  if (data.seasonAvg != null) {
    drawText(ctx, `Season avg: ${fmt(data.seasonAvg)} PPG`, CARD_W - PAD, cy, {
      font: `400 10px ${FONT}`, color: MUTED, align: "right",
    });
  }

  return canvas;
}

/* ─── COMPARE CARD ─── */
/**
 * data: {
 *   p1: { name, position?, teamAbbr?, headshotUrl?, gamesPlayed? },
 *   p2: { name, position?, teamAbbr?, headshotUrl?, gamesPlayed? },
 *   stats: [{ label, v1, v2, higherBetter? }],
 *   p1Wins, p2Wins,
 *   accentColor?,
 * }
 */
export async function renderCompareCard(data) {
  const [h1, h2] = await Promise.all([
    loadImg(data.p1.headshotUrl),
    loadImg(data.p2.headshotUrl),
  ]);

  const rowH = 28;
  let h = PAD;
  h += 70;                       // header (names, headshots, win counts)
  h += 10;                       // gap
  h += data.stats.length * rowH; // stat rows
  h += 14;                       // gap
  h += 16;                       // footer
  h += PAD;

  const { canvas, ctx } = createCanvas(CARD_W, h);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CARD_W, h);
  fillRoundRect(ctx, 0, 0, CARD_W, h, 14, CARD_BG);
  strokeRoundRect(ctx, 0, 0, CARD_W, h, 14, CARD_BORDER);

  const mid = CARD_W / 2;
  let cy = PAD;

  // ── player 1 (left) ──
  const imgR = 20;
  const p1ImgX = mid - 50;
  if (h1) drawCircleImg(ctx, h1, p1ImgX, cy + imgR, imgR);
  drawText(ctx, data.p1.name, p1ImgX - imgR - 8, cy + 4, {
    font: `700 13px ${FONT}`, color: WHITE, align: "right", maxWidth: mid - 80,
  });
  drawText(ctx, [data.p1.teamAbbr, data.p1.position].filter(Boolean).join(" · "), p1ImgX - imgR - 8, cy + 22, {
    font: `400 10px ${FONT}`, color: FAINT, align: "right",
  });
  // p1 win count
  const p1Color = data.p1Wins > data.p2Wins ? GREEN : data.p1Wins < data.p2Wins ? RED : YELLOW;
  drawText(ctx, String(data.p1Wins), p1ImgX - imgR - 8, cy + 40, {
    font: `900 22px ${FONT}`, color: p1Color, align: "right",
  });

  // VS
  drawText(ctx, "VS", mid, cy + 12, { font: `900 12px ${FONT}`, color: ACCENT, align: "center" });
  drawText(ctx, `${data.stats.length} cats`, mid, cy + 28, { font: `400 9px ${FONT}`, color: FAINT, align: "center" });

  // ── player 2 (right) ──
  const p2ImgX = mid + 50;
  if (h2) drawCircleImg(ctx, h2, p2ImgX, cy + imgR, imgR);
  drawText(ctx, data.p2.name, p2ImgX + imgR + 8, cy + 4, {
    font: `700 13px ${FONT}`, color: WHITE, maxWidth: mid - 80,
  });
  drawText(ctx, [data.p2.teamAbbr, data.p2.position].filter(Boolean).join(" · "), p2ImgX + imgR + 8, cy + 22, {
    font: `400 10px ${FONT}`, color: FAINT,
  });
  const p2Color = data.p2Wins > data.p1Wins ? GREEN : data.p2Wins < data.p1Wins ? RED : YELLOW;
  drawText(ctx, String(data.p2Wins), p2ImgX + imgR + 8, cy + 40, {
    font: `900 22px ${FONT}`, color: p2Color,
  });

  cy += 70 + 10;

  // ── stat rows ──
  data.stats.forEach((st, i) => {
    const ry = cy + i * rowH;
    if (i < data.stats.length) {
      drawLine(ctx, PAD, ry + rowH - 1, CARD_W - PAD, ry + rowH - 1, "rgba(255,255,255,0.03)");
    }

    const v1 = Number(st.v1 || 0);
    const v2 = Number(st.v2 || 0);
    const hb = st.higherBetter !== false;
    const c1 = hb ? (v1 > v2 ? GREEN : v1 < v2 ? RED : YELLOW) : (v1 < v2 ? GREEN : v1 > v2 ? RED : YELLOW);
    const c2 = hb ? (v2 > v1 ? GREEN : v2 < v1 ? RED : YELLOW) : (v2 < v1 ? GREEN : v2 > v1 ? RED : YELLOW);

    const fmtV = (v) => Number(v || 0).toFixed(1);

    drawText(ctx, fmtV(v1), mid - 34, ry + 6, { font: `700 13px ${FONT}`, color: c1, align: "right" });
    drawText(ctx, st.label, mid, ry + 7, { font: `600 10px ${FONT}`, color: FAINT, align: "center" });
    drawText(ctx, fmtV(v2), mid + 34, ry + 6, { font: `700 13px ${FONT}`, color: c2, align: "left" });
  });

  cy += data.stats.length * rowH + 14;

  // footer
  drawText(ctx, "STATLINE", PAD, cy, { font: `700 10px ${FONT}`, color: BRAND });
  const gpText = [
    data.p1.gamesPlayed != null ? `${data.p1.gamesPlayed} GP` : null,
    data.p2.gamesPlayed != null ? `${data.p2.gamesPlayed} GP` : null,
  ].filter(Boolean).join(" vs ");
  if (gpText) {
    drawText(ctx, gpText, CARD_W - PAD, cy, { font: `400 10px ${FONT}`, color: MUTED, align: "right" });
  }

  return canvas;
}

/* ─── SHARE / DOWNLOAD ─── */
/**
 * Trigger native share or fallback download.
 * @param {HTMLCanvasElement} canvas
 * @param {string} filename  — without extension
 * @param {string} [shareUrl] — optional URL to include with native share
 * @returns {Promise<void>}
 */
export function shareCanvas(canvas, filename, shareUrl) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(); return; }
      const file = new File([blob], filename + ".png", { type: "image/png" });

      if (navigator.share && navigator.canShare) {
        const shareData = { files: [file], title: filename };
        if (shareUrl) shareData.url = shareUrl;
        if (navigator.canShare(shareData)) {
          navigator.share(shareData).catch(() => {}).finally(resolve);
          return;
        }
        // try without files
        if (shareUrl) {
          navigator.share({ title: filename, url: shareUrl }).catch(() => {}).finally(resolve);
          return;
        }
      }

      // fallback: download
      const link = document.createElement("a");
      link.download = filename + ".png";
      link.href = canvas.toDataURL("image/png");
      link.click();
      resolve();
    }, "image/png");
  });
}
