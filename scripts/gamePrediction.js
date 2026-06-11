// scripts/gamePrediction.js — Gemini powered
import { generate } from "./ai.js";
import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../tmp/output");
const W = 1280, H = 720;

export async function generatePredictionScript(match, data) {
  const h2h = (data.h2h || []).map(m => `${m.home} ${m.homeScore}-${m.awayScore} ${m.away} (${m.date})`).join("\n") || "No recent H2H";

  const script = await generate(`You are a bold FIFA World Cup predictor on YouTube Shorts.
Write a 60-second PREDICTION script. Take a clear side, back it with logic.

MATCH: ${match.home.name} vs ${match.away.name}  |  ${match.round}
LAST 5 H2H: ${h2h}

FORMAT:
[HOOK] Your prediction stated boldly upfront.
[REASON 1] First reason — stats or form.
[REASON 2] Second reason — tactical or key player.
[WILDCARD] One thing that could flip it.
[SCORE] Exact score prediction with confidence level.
[OUTRO] Tell viewers to save this and check back after the match.

Under 180 words. Be cocky and entertaining.`);

  const scoreMatch = script.match(/(\d)\s*[-–]\s*(\d)/);
  const predictedScore = scoreMatch
    ? { home: parseInt(scoreMatch[1]), away: parseInt(scoreMatch[2]) }
    : { home: 1, away: 0 };

  const meta = await generate(`YouTube metadata for prediction video: ${match.home.name} vs ${match.away.name} FIFA World Cup 2026.
TITLE: (include PREDICTION, max 70 chars)
DESCRIPTION: (2-3 sentences)
HASHTAGS: (8 tags)
Format — TITLE: ... DESCRIPTION: ... HASHTAGS: ...`, 300);

  return {
    script, predictedScore,
    title: meta.match(/TITLE:\s*(.+)/)?.[1]?.trim() || `${match.home.name} vs ${match.away.name} Prediction | WC2026`,
    description: meta.match(/DESCRIPTION:\s*([\s\S]+?)(?=HASHTAGS:|$)/)?.[1]?.trim() || script.slice(0, 300),
    hashtags: meta.match(/HASHTAGS:\s*(.+)/)?.[1]?.trim() || "#FIFAWorldCup2026",
    videoType: "prediction",
  };
}

export function renderPredictionThumbnail(match, predictedScore) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const bg = ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,"#0a0520"); bg.addColorStop(1,"#0d1a3a");
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  const glow=ctx.createRadialGradient(W/2,H/2-40,0,W/2,H/2-40,300);
  glow.addColorStop(0,"rgba(150,80,255,0.15)"); glow.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=glow; ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#9650ff"; ctx.fillRect(0,0,W,6);
  ctx.fillStyle="rgba(150,80,255,0.15)"; ctx.beginPath(); ctx.roundRect(W/2-130,18,260,42,6); ctx.fill();
  ctx.fillStyle="#b07aff"; ctx.font="bold 18px monospace"; ctx.textAlign="center";
  ctx.fillText("🔮 PREDICTION",W/2,46);
  ctx.shadowColor="rgba(0,0,0,0.9)"; ctx.shadowBlur=12;
  ctx.fillStyle="#fff"; ctx.font="bold 56px sans-serif";
  ctx.fillText(match.home.name.toUpperCase(),W/4,200);
  ctx.fillText(match.away.name.toUpperCase(),W*3/4,200);
  ctx.shadowBlur=0;
  ctx.fillStyle="rgba(10,5,30,0.95)"; ctx.beginPath(); ctx.roundRect(W/2-180,240,360,180,14); ctx.fill();
  ctx.strokeStyle="#9650ff"; ctx.lineWidth=2.5; ctx.stroke();
  ctx.fillStyle="rgba(150,80,255,0.2)"; ctx.beginPath(); ctx.roundRect(W/2-130,252,260,34,6); ctx.fill();
  ctx.fillStyle="#b07aff"; ctx.font="bold 16px monospace";
  ctx.fillText("MY PREDICTION",W/2,275);
  ctx.fillStyle="#fff"; ctx.font="bold 100px monospace";
  ctx.shadowColor="rgba(150,80,255,0.5)"; ctx.shadowBlur=20;
  ctx.fillText(`${predictedScore?.home??1} - ${predictedScore?.away??0}`,W/2,390);
  ctx.shadowBlur=0;
  ctx.fillStyle="#9650ff"; ctx.font="bold 20px monospace";
  ctx.fillText("KICKOFF IN 2 HOURS",W/2,418);
  const fade=ctx.createLinearGradient(0,H-150,0,H);
  fade.addColorStop(0,"rgba(0,0,0,0)"); fade.addColorStop(1,"rgba(0,0,0,0.85)");
  ctx.fillStyle=fade; ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#fff"; ctx.font="bold 52px sans-serif";
  ctx.shadowColor="rgba(0,0,0,0.95)"; ctx.shadowBlur=14;
  ctx.fillText("AM I RIGHT? 🔮",W/2,H-42); ctx.shadowBlur=0;
  const p=path.join(OUTPUT_DIR,`prediction_thumb_${match.id||Date.now()}.png`);
  fs.writeFileSync(p,canvas.toBuffer("image/png")); return p;
}
