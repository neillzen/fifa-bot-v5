// scripts/generateThumbnail.js
// Generates a high-CTR YouTube thumbnail (1280x720) for each match
// Design: split team colors, giant score, flags, hook text

import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../tmp/output");

const W = 1280;
const H = 720;

const FLAGS = {
  Brazil: "🇧🇷", France: "🇫🇷", Argentina: "🇦🇷", Germany: "🇩🇪",
  Spain: "🇪🇸", England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", Portugal: "🇵🇹", Netherlands: "🇳🇱",
  Italy: "🇮🇹", Belgium: "🇧🇪", Croatia: "🇭🇷", Morocco: "🇲🇦",
  Senegal: "🇸🇳", Japan: "🇯🇵", "South Korea": "🇰🇷", USA: "🇺🇸",
  Mexico: "🇲🇽", Uruguay: "🇺🇾", Colombia: "🇨🇴", Ecuador: "🇪🇨",
  Switzerland: "🇨🇭", Denmark: "🇩🇰", Poland: "🇵🇱", Serbia: "🇷🇸",
  Australia: "🇦🇺", Canada: "🇨🇦", "Saudi Arabia": "🇸🇦", Ghana: "🇬🇭",
};

const TEAM_COLORS = {
  Brazil: "#FFDF00", France: "#002395", Argentina: "#74ACDF",
  Germany: "#222222", Spain: "#AA151B", England: "#CF142B",
  Portugal: "#006600", Netherlands: "#FF6600", Italy: "#009246",
  Belgium: "#EF3340", Croatia: "#FF0000", Morocco: "#C1272D",
  USA: "#3C3B6E", Mexico: "#006847", Uruguay: "#75AADB",
  default: "#1a2a4a",
};

function getTeamColor(name) {
  return TEAM_COLORS[name] || TEAM_COLORS.default;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function getHookText(match) {
  const diff = match.home.score - match.away.score;
  const total = match.home.score + match.away.score;
  const winner = diff > 0 ? match.home.name : diff < 0 ? match.away.name : null;
  const round = (match.round || "").toLowerCase();

  if (diff === 0 && total === 0) return "GOALLESS THRILLER";
  if (diff === 0) return "DRAW! 🤯";
  if (round.includes("final") && !round.includes("semi") && !round.includes("quarter")) return "WORLD CHAMPIONS! 🏆";
  if (round.includes("semi")) return "FINAL SPOT SECURED ⚡";
  if (round.includes("quarter")) return "SEMI-FINAL BOUND 🔥";
  if (Math.abs(diff) >= 4) return `${winner?.toUpperCase()} DEMOLISH THEM`;
  if (total >= 6) return `${total} GOALS! INSANE 🔥`;
  if (Math.abs(diff) === 1 && total >= 4) return "WHAT A GAME 🔥";
  return `${winner?.toUpperCase()} WIN`;
}

export function generateThumbnail(match) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const homeColor = getTeamColor(match.home.name);
  const awayColor = getTeamColor(match.away.name);
  const homeRgb = hexToRgb(homeColor);
  const awayRgb = hexToRgb(awayColor);

  // ── Split background (darkened team colors) ──────────────────
  ctx.fillStyle = `rgb(${Math.round(homeRgb.r * 0.25)}, ${Math.round(homeRgb.g * 0.25)}, ${Math.round(homeRgb.b * 0.25)})`;
  ctx.fillRect(0, 0, W / 2, H);
  ctx.fillStyle = `rgb(${Math.round(awayRgb.r * 0.25)}, ${Math.round(awayRgb.g * 0.25)}, ${Math.round(awayRgb.b * 0.25)})`;
  ctx.fillRect(W / 2, 0, W / 2, H);

  // Dark center + edge overlay
  const overlay = ctx.createLinearGradient(0, 0, W, 0);
  overlay.addColorStop(0, "rgba(0,0,0,0.5)");
  overlay.addColorStop(0.42, "rgba(0,0,0,0.15)");
  overlay.addColorStop(0.58, "rgba(0,0,0,0.15)");
  overlay.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, W, H);

  // Bottom fade
  const bottomFade = ctx.createLinearGradient(0, H * 0.55, 0, H);
  bottomFade.addColorStop(0, "rgba(0,0,0,0)");
  bottomFade.addColorStop(1, "rgba(0,0,0,0.88)");
  ctx.fillStyle = bottomFade;
  ctx.fillRect(0, 0, W, H);

  // ── Center split line ────────────────────────────────────────
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();

  // ── Top badge ────────────────────────────────────────────────
  ctx.fillStyle = "rgba(212,175,55,0.12)";
  ctx.beginPath(); ctx.roundRect(W / 2 - 195, 16, 390, 44, 6); ctx.fill();
  ctx.strokeStyle = "#d4af3755"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#d4af37";
  ctx.font = "bold 17px monospace";
  ctx.textAlign = "center";
  ctx.fillText("⚽  FIFA WORLD CUP 2026  ·  " + (match.round || "GROUP STAGE").toUpperCase(), W / 2, 45);

  // ── Flags ────────────────────────────────────────────────────
  ctx.font = "130px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(FLAGS[match.home.name] || "🏳️", W / 4, 220);
  ctx.fillText(FLAGS[match.away.name] || "🏳️", (W * 3) / 4, 220);

  // ── Team names ───────────────────────────────────────────────
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 50px sans-serif";
  ctx.fillText(match.home.name.toUpperCase(), W / 4, 295);
  ctx.fillText(match.away.name.toUpperCase(), (W * 3) / 4, 295);
  ctx.shadowBlur = 0;

  // ── Score card ───────────────────────────────────────────────
  ctx.fillStyle = "rgba(4, 6, 16, 0.93)";
  ctx.beginPath(); ctx.roundRect(W / 2 - 155, 316, 310, 172, 14); ctx.fill();
  ctx.strokeStyle = "#d4af37"; ctx.lineWidth = 3; ctx.stroke();

  // Score
  ctx.fillStyle = "#d4af37";
  ctx.font = "bold 108px monospace";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(212,175,55,0.5)";
  ctx.shadowBlur = 24;
  ctx.fillText(`${match.home.score} - ${match.away.score}`, W / 2, 437);
  ctx.shadowBlur = 0;

  // FT
  ctx.fillStyle = "#4caf50";
  ctx.font = "bold 21px monospace";
  ctx.fillText("● FULL TIME", W / 2, 472);

  // ── Goal scorers (sides) ─────────────────────────────────────
  if (match.goals?.length > 0) {
    ctx.font = "17px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 8;

    match.goals.filter(g => g.team === match.home.name).forEach((g, i) => {
      ctx.textAlign = "left";
      ctx.fillText(`⚽ ${g.player} ${g.minute}'`, 22, 346 + i * 24);
    });
    match.goals.filter(g => g.team === match.away.name).forEach((g, i) => {
      ctx.textAlign = "right";
      ctx.fillText(`${g.minute}' ${g.player} ⚽`, W - 22, 346 + i * 24);
    });
    ctx.shadowBlur = 0;
  }

  // ── Hook text strip ──────────────────────────────────────────
  ctx.fillStyle = "rgba(212,175,55,0.1)";
  ctx.fillRect(0, H - 108, W, 108);
  ctx.fillStyle = "#d4af37";
  ctx.fillRect(0, H - 110, W, 3);

  const hookText = getHookText(match);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 60px sans-serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 18;
  ctx.fillText(hookText, W / 2, H - 38);
  ctx.shadowBlur = 0;

  // ── Team color accent lines (bottom corners) ─────────────────
  ctx.fillStyle = homeColor;
  ctx.fillRect(0, H - 6, W / 2, 6);
  ctx.fillStyle = awayColor;
  ctx.fillRect(W / 2, H - 6, W / 2, 6);

  const thumbPath = path.join(OUTPUT_DIR, `thumb_${match.id || Date.now()}.png`);
  fs.writeFileSync(thumbPath, canvas.toBuffer("image/png"));
  console.log(`🖼️  Thumbnail saved: ${thumbPath}`);
  return thumbPath;
}

// Standalone test
if (process.argv[1].includes("generateThumbnail")) {
  const testMatch = {
    id: "test_thumb",
    home: { name: "Brazil", score: 3 },
    away: { name: "France", score: 2 },
    round: "Quarter Final",
    goals: [
      { player: "Vinicius Jr.", minute: 12, team: "Brazil" },
      { player: "Mbappé", minute: 34, team: "France" },
      { player: "Rodrygo", minute: 56, team: "Brazil" },
      { player: "Griezmann", minute: 71, team: "France" },
      { player: "Endrick", minute: 88, team: "Brazil" },
    ],
  };
  console.log("🖼️  Generating test thumbnail...");
  const out = generateThumbnail(testMatch);
  console.log("✅ Done:", out);
}
