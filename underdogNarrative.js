// scripts/underdogNarrative.js
// Two video types:
// 1. Pre-match underdog hype (when FIFA ranking diff >= 20 spots)
// 2. Post-match upset celebration (if underdog actually wins)

import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../tmp/output");
const W = 1280, H = 720;
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Approximate FIFA rankings (2026 projections)
const FIFA_RANKINGS = {
  Argentina: 1, France: 2, England: 3, Brazil: 4, Belgium: 5,
  Portugal: 6, Netherlands: 7, Spain: 8, Germany: 9, Croatia: 10,
  Italy: 11, Uruguay: 12, "United States": 13, Mexico: 14,
  Denmark: 15, Switzerland: 16, Japan: 17, "South Korea": 18,
  Colombia: 19, Senegal: 20, Morocco: 21, Australia: 22,
  Canada: 23, Ecuador: 24, Peru: 25, Poland: 26, Serbia: 27,
  Ukraine: 28, Tunisia: 29, Ghana: 30, Cameroon: 31,
  "Saudi Arabia": 32, Iran: 33, "Costa Rica": 40, Bolivia: 45,
  Panama: 50, "New Zealand": 60,
};

function getRanking(teamName) {
  return FIFA_RANKINGS[teamName] || 50;
}

// Determine underdog (higher ranking number = worse ranked)
export function detectUnderdog(match) {
  const homeRank = getRanking(match.home.name);
  const awayRank = getRanking(match.away.name);
  const diff = Math.abs(homeRank - awayRank);

  if (diff < 15) return null; // Not enough of a gap

  const underdog = homeRank > awayRank ? match.home : match.away;
  const favourite = homeRank > awayRank ? match.away : match.home;

  return {
    underdog,
    favourite,
    underdogRank: Math.max(homeRank, awayRank),
    favouriteRank: Math.min(homeRank, awayRank),
    rankDiff: diff,
  };
}

// Check if underdog actually won
export function didUnderdogWin(match, underdogInfo) {
  if (!underdogInfo) return false;
  const { underdog } = underdogInfo;
  const isHome = underdog.name === match.home.name;
  const underdogScore = isHome ? match.home.score : match.away.score;
  const favouriteScore = isHome ? match.away.score : match.home.score;
  return underdogScore > favouriteScore;
}

// ── Pre-match underdog hype script ───────────────────────────
export async function generateUnderdogPreScript(match, info) {
  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 1024,
    messages: [{ role: "user", content: `You are a FIFA World Cup storyteller. Write a 75-second UNDERDOG HYPE video script.

MATCH: ${match.home.name} vs ${match.away.name}  |  ${match.round}
UNDERDOG: ${info.underdog.name} (FIFA Rank #${info.underdogRank})
FAVOURITE: ${info.favourite.name} (FIFA Rank #${info.favouriteRank})
RANKING GAP: ${info.rankDiff} places

FORMAT EXACTLY:
[HOOK] One electric opening line. Frame the impossible mission.
[THE GIANT] 2 sentences on why ${info.favourite.name} is so dangerous/dominant.
[THE UNDERDOG] 2 sentences on why ${info.underdog.name} should NOT be written off. Give real historical context.
[GIANT KILLERS] Name 2-3 legendary World Cup upsets to inspire belief (e.g. USA 1950, Cameroon 1990, South Korea 2002, Morocco 2022).
[THE BELIEF] Why THIS could be the upset of 2026. One specific tactical or emotional reason.
[OUTRO] "Can ${info.underdog.name} make history? Comment YES or NO 👇"

Under 200 words. Make it feel like a sports movie trailer.` }],
  });

  const script = msg.content[0].text;
  const metaMsg = await client.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 250,
    messages: [{ role: "user", content: `YouTube metadata for underdog preview: ${info.underdog.name} vs ${info.favourite.name} FIFA World Cup 2026.
TITLE: (use words like UNDERDOG, GIANT KILLER, UPSET, CAN THEY?, max 70 chars)
DESCRIPTION: (2-3 sentences, dramatic)
HASHTAGS: (8 tags including both team names)
Format — TITLE: ... DESCRIPTION: ... HASHTAGS: ...` }],
  });

  const meta = metaMsg.content[0].text;
  return {
    script,
    title: meta.match(/TITLE:\s*(.+)/)?.[1]?.trim() || `Can ${info.underdog.name} Cause the UPSET? | WC2026`,
    description: meta.match(/DESCRIPTION:\s*([\s\S]+?)(?=HASHTAGS:|$)/)?.[1]?.trim() || script.slice(0, 300),
    hashtags: meta.match(/HASHTAGS:\s*(.+)/)?.[1]?.trim() || "#FIFAWorldCup2026 #Upset",
    videoType: "underdog-pre",
  };
}

// ── Post-match upset celebration script ──────────────────────
export async function generateUnderdogPostScript(match, info) {
  const isHome = info.underdog.name === match.home.name;
  const uScore = isHome ? match.home.score : match.away.score;
  const fScore = isHome ? match.away.score : match.home.score;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 1024,
    messages: [{ role: "user", content: `You are a FIFA World Cup commentator losing your mind at a giant upset. Write a 60-second UPSET CELEBRATION script.

MATCH: ${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}
UPSET: ${info.underdog.name} (#${info.underdogRank}) BEAT ${info.favourite.name} (#${info.favouriteRank})
FINAL SCORE: ${info.underdog.name} ${uScore} - ${fScore} ${info.favourite.name}

FORMAT EXACTLY:
[EXPLOSION] One line that captures the sheer shock. All caps energy.
[THE RESULT] State the score dramatically. "I repeat..."
[HOW] 2 sentences on how ${info.underdog.name} pulled it off tactically/emotionally.
[HISTORY] 1 sentence comparing to other all-time World Cup upsets.
[REACTION] "The football world just stopped. Let that sink in."
[OUTRO] Ask viewers where they rank this in World Cup history.

Under 160 words. Maximum hype. This is a historic moment.` }],
  });

  const script = msg.content[0].text;
  const metaMsg = await client.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 250,
    messages: [{ role: "user", content: `YouTube metadata for historic World Cup upset: ${info.underdog.name} beat ${info.favourite.name} ${uScore}-${fScore} FIFA World Cup 2026.
TITLE: (use SHOCK, UPSET, HISTORY, ELIMINATED, max 70 chars, must mention score)
DESCRIPTION: (2-3 sentences hyping the historic nature)
HASHTAGS: (8 tags)
Format — TITLE: ... DESCRIPTION: ... HASHTAGS: ...` }],
  });

  const meta = metaMsg.content[0].text;
  return {
    script,
    title: meta.match(/TITLE:\s*(.+)/)?.[1]?.trim() || `${info.underdog.name} SHOCK ${info.favourite.name} ${uScore}-${fScore} | WC2026 UPSET`,
    description: meta.match(/DESCRIPTION:\s*([\s\S]+?)(?=HASHTAGS:|$)/)?.[1]?.trim() || script.slice(0, 300),
    hashtags: meta.match(/HASHTAGS:\s*(.+)/)?.[1]?.trim() || "#FIFAWorldCup2026 #Upset",
    videoType: "underdog-post",
  };
}

// ── Underdog pre-match thumbnail ─────────────────────────────
export function renderUnderdogPreThumbnail(match, info) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Gritty dark bg
  const bg = ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,"#0a0500"); bg.addColorStop(1,"#1a0a00");
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

  // Fire glow from bottom
  const fire = ctx.createRadialGradient(W/2,H,0,W/2,H,500);
  fire.addColorStop(0,"rgba(255,80,0,0.2)"); fire.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle = fire; ctx.fillRect(0,0,W,H);

  // Orange top bar
  ctx.fillStyle = "#ff4400"; ctx.fillRect(0,0,W,7);

  // UNDERDOG badge
  ctx.fillStyle = "rgba(255,68,0,0.15)";
  ctx.beginPath(); ctx.roundRect(W/2-175,16,350,42,6); ctx.fill();
  ctx.strokeStyle = "#ff440055"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#ff6622"; ctx.font = "bold 18px monospace"; ctx.textAlign = "center";
  ctx.fillText("🔥 CAN THEY CAUSE THE UPSET?", W/2, 44);

  // Favourite (top, faded)
  ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 10;
  ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.font = "bold 42px sans-serif";
  ctx.fillText(`#${info.favouriteRank} ${info.favourite.name.toUpperCase()}`, W/2, 160);

  // VS
  ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.font = "bold 28px monospace";
  ctx.fillText("vs", W/2, 200);
  ctx.shadowBlur = 0;

  // Underdog (big, lit up)
  ctx.shadowColor = "rgba(255,80,0,0.6)"; ctx.shadowBlur = 24;
  ctx.fillStyle = "#ff8844"; ctx.font = "bold 82px sans-serif";
  ctx.fillText(info.underdog.name.toUpperCase(), W/2, 310);
  ctx.shadowBlur = 0;

  // Rank badge
  ctx.fillStyle = "rgba(255,68,0,0.15)";
  ctx.beginPath(); ctx.roundRect(W/2-100,328,200,44,22); ctx.fill();
  ctx.fillStyle = "#ff6622"; ctx.font = "bold 20px monospace";
  ctx.fillText(`FIFA RANK #${info.underdogRank}`, W/2, 356);

  // History reference
  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "italic 22px sans-serif";
  ctx.fillText("Remember Morocco 2022? Japan 2022? Cameroon 1990?", W/2, 420);

  const fade = ctx.createLinearGradient(0,H-170,0,H);
  fade.addColorStop(0,"rgba(0,0,0,0)"); fade.addColorStop(1,"rgba(0,0,0,0.92)");
  ctx.fillStyle = fade; ctx.fillRect(0,0,W,H);

  ctx.fillStyle = "#fff"; ctx.font = "bold 54px sans-serif";
  ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 14;
  ctx.fillText(`CAN ${info.underdog.name.toUpperCase()} DO IT? 🔥`, W/2, H-42);
  ctx.shadowBlur = 0;

  const p = path.join(OUTPUT_DIR, `underdog_pre_${match.id||Date.now()}.png`);
  fs.writeFileSync(p, canvas.toBuffer("image/png"));
  return p;
}

// ── Underdog post-match upset thumbnail ──────────────────────
export function renderUnderdogPostThumbnail(match, info) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Explosive red/orange
  const bg = ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,"#1a0000"); bg.addColorStop(0.5,"#2a0800"); bg.addColorStop(1,"#1a0000");
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

  const burst = ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,400);
  burst.addColorStop(0,"rgba(255,100,0,0.25)"); burst.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle = burst; ctx.fillRect(0,0,W,H);

  // Bold red top bar
  ctx.fillStyle = "#ff0000"; ctx.fillRect(0,0,W,8);

  // UPSET badge
  ctx.fillStyle = "rgba(255,0,0,0.2)";
  ctx.beginPath(); ctx.roundRect(W/2-140,16,280,44,6); ctx.fill();
  ctx.strokeStyle = "#ff000077"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#ff4444"; ctx.font = "bold 22px monospace"; ctx.textAlign = "center";
  ctx.fillText("🚨 HISTORIC UPSET", W/2, 46);

  // Match result
  const isHome = info.underdog.name === match.home.name;
  const uScore = isHome ? match.home.score : match.away.score;
  const fScore = isHome ? match.away.score : match.home.score;

  ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 16;
  ctx.fillStyle = "#ff8844"; ctx.font = "bold 72px sans-serif";
  ctx.fillText(info.underdog.name.toUpperCase(), W/4, 200);
  ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "bold 48px sans-serif";
  ctx.fillText(info.favourite.name.toUpperCase(), W*3/4, 200);
  ctx.shadowBlur = 0;

  // Score
  ctx.fillStyle = "rgba(0,0,0,0.8)";
  ctx.beginPath(); ctx.roundRect(W/2-175,220,350,160,14); ctx.fill();
  ctx.strokeStyle = "#ff4400"; ctx.lineWidth = 3; ctx.stroke();

  ctx.fillStyle = "#ff6622"; ctx.font = "bold 96px monospace";
  ctx.shadowColor = "rgba(255,68,0,0.5)"; ctx.shadowBlur = 20;
  ctx.fillText(`${uScore} - ${fScore}`, W/2, 330);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ff4444"; ctx.font = "bold 20px monospace";
  ctx.fillText("FULL TIME", W/2, 368);

  // Rank context
  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "bold 22px monospace";
  ctx.fillText(`RANK #${info.underdogRank} beats RANK #${info.favouriteRank}`, W/2, 430);

  const fade = ctx.createLinearGradient(0,H-170,0,H);
  fade.addColorStop(0,"rgba(0,0,0,0)"); fade.addColorStop(1,"rgba(0,0,0,0.92)");
  ctx.fillStyle = fade; ctx.fillRect(0,0,W,H);

  ctx.fillStyle = "#ffffff"; ctx.font = "bold 52px sans-serif";
  ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 14;
  ctx.fillText(`${info.underdog.name.toUpperCase()} MAKE HISTORY 🚨`, W/2, H-42);
  ctx.shadowBlur = 0;

  const p = path.join(OUTPUT_DIR, `underdog_post_${match.id||Date.now()}.png`);
  fs.writeFileSync(p, canvas.toBuffer("image/png"));
  return p;
}
