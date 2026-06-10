// scripts/gamePrediction.js
// Game prediction video — runs 2hrs before kickoff
// Uses team form, H2H, and Claude to make a bold prediction

import Anthropic from "@anthropic-ai/sdk";
import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../tmp/output");
const W = 1280, H = 720;
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generatePredictionScript(match, data) {
  const h2hSummary = (data.h2h || []).map(m =>
    `${m.home} ${m.homeScore}-${m.awayScore} ${m.away} (${m.date})`
  ).join("\n") || "No recent H2H";

  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 1024,
    messages: [{ role: "user", content: `You are a bold FIFA World Cup predictor on YouTube Shorts.
Write a 60-second PREDICTION video script. Be confident, take a clear side, back it with logic.

MATCH: ${match.home.name} vs ${match.away.name}  |  ${match.round}
KICKOFF: ${match.date}
LAST 5 H2H: ${h2hSummary}

FORMAT EXACTLY:
[HOOK] One bold claim — your prediction stated upfront.
[REASON 1] First reason why (stats / form / history).
[REASON 2] Second reason (tactical / key player).
[WILDCARD] One thing that could flip it.
[SCORE] Exact score prediction with confidence level (e.g. "Brazil 2-1 France — 75% confident").
[OUTRO] Tell viewers to save this and check back after the match.

Under 180 words. Be cocky and entertaining. Gen Z tone.` }],
  });

  const script = msg.content[0].text;

  // Extract score prediction from script
  const scoreMatch = script.match(/(\w[\w\s]+)\s+(\d)-(\d)\s+(\w[\w\s]+)/);
  const predictedScore = scoreMatch
    ? { home: parseInt(scoreMatch[2]), away: parseInt(scoreMatch[3]) }
    : { home: 1, away: 0 };

  const metaMsg = await client.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 250,
    messages: [{ role: "user", content: `YouTube metadata for a prediction video: ${match.home.name} vs ${match.away.name} FIFA World Cup 2026.
TITLE: (include PREDICTION, max 70 chars, make it clickable)
DESCRIPTION: (2-3 sentences)
HASHTAGS: (8 tags)
Format: TITLE: ... DESCRIPTION: ... HASHTAGS: ...` }],
  });

  const meta = metaMsg.content[0].text;
  return {
    script, predictedScore,
    title: meta.match(/TITLE:\s*(.+)/)?.[1]?.trim() || `${match.home.name} vs ${match.away.name} Prediction | WC2026`,
    description: meta.match(/DESCRIPTION:\s*([\s\S]+?)(?=HASHTAGS:|$)/)?.[1]?.trim() || script.slice(0, 300),
    hashtags: meta.match(/HASHTAGS:\s*(.+)/)?.[1]?.trim() || "#WorldCup2026Prediction",
    videoType: "prediction",
  };
}

export function renderPredictionThumbnail(match, predictedScore) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Deep purple/navy prediction vibe
  const bg = ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,"#0a0520"); bg.addColorStop(1,"#0d1a3a");
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

  // Glowing center orb
  const glow = ctx.createRadialGradient(W/2,H/2-40,0,W/2,H/2-40,300);
  glow.addColorStop(0,"rgba(150,80,255,0.15)"); glow.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(0,0,W,H);

  ctx.fillStyle = "#9650ff"; ctx.fillRect(0,0,W,6);

  // PREDICTION label
  ctx.fillStyle = "rgba(150,80,255,0.15)";
  ctx.beginPath(); ctx.roundRect(W/2-130,18,260,42,6); ctx.fill();
  ctx.fillStyle = "#b07aff"; ctx.font = "bold 18px monospace"; ctx.textAlign = "center";
  ctx.fillText("🔮 PREDICTION", W/2, 46);

  // Team names
  ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 12;
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 56px sans-serif";
  ctx.fillText(match.home.name.toUpperCase(), W/4, 200);
  ctx.fillText(match.away.name.toUpperCase(), W*3/4, 200);
  ctx.shadowBlur = 0;

  // Predicted score card
  ctx.fillStyle = "rgba(10,5,30,0.95)";
  ctx.beginPath(); ctx.roundRect(W/2-180,240,360,180,14); ctx.fill();
  ctx.strokeStyle = "#9650ff"; ctx.lineWidth = 2.5; ctx.stroke();

  ctx.fillStyle = "rgba(150,80,255,0.2)";
  ctx.beginPath(); ctx.roundRect(W/2-130,252,260,34,6); ctx.fill();
  ctx.fillStyle = "#b07aff"; ctx.font = "bold 16px monospace";
  ctx.fillText("MY PREDICTION", W/2, 275);

  ctx.fillStyle = "#ffffff"; ctx.font = "bold 100px monospace";
  ctx.shadowColor = "rgba(150,80,255,0.5)"; ctx.shadowBlur = 20;
  ctx.fillText(`${predictedScore?.home ?? 1} - ${predictedScore?.away ?? 0}`, W/2, 390);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#9650ff"; ctx.font = "bold 20px monospace";
  ctx.fillText("KICKOFF IN 2 HOURS", W/2, 418);

  // Bottom
  const fade = ctx.createLinearGradient(0,H-150,0,H);
  fade.addColorStop(0,"rgba(0,0,0,0)"); fade.addColorStop(1,"rgba(0,0,0,0.85)");
  ctx.fillStyle = fade; ctx.fillRect(0,0,W,H);

  ctx.fillStyle = "#fff"; ctx.font = "bold 52px sans-serif";
  ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 14;
  ctx.fillText("AM I RIGHT? 🔮", W/2, H-42);
  ctx.shadowBlur = 0;

  const p = path.join(OUTPUT_DIR, `prediction_thumb_${match.id||Date.now()}.png`);
  fs.writeFileSync(p, canvas.toBuffer("image/png"));
  return p;
}
