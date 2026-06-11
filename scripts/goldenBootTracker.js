import { generate, generateJSON } from "./ai.js";
// scripts/predictionCallback.js
// After each match, references back to the prediction video
// "We predicted X — here's what actually happened"
// Builds trust + drives viewers to watch prediction video = more watch time


import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../tmp/output");
const W = 1280, H = 720;


export function getPredictionResult(match, predictedScore) {
  if (!predictedScore) return { correct: false, type: "unknown" };

  const predictedWinner =
    predictedScore.home > predictedScore.away ? "home" :
    predictedScore.away > predictedScore.home ? "away" : "draw";

  const actualWinner =
    match.home.score > match.away.score ? "home" :
    match.away.score > match.home.score ? "away" : "draw";

  const exactScore = predictedScore.home === match.home.score && predictedScore.away === match.away.score;
  const correctResult = predictedWinner === actualWinner;

  return {
    exactScore,
    correctResult,
    predicted: `${match.home.name} ${predictedScore.home}-${predictedScore.away} ${match.away.name}`,
    actual: `${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}`,
    type: exactScore ? "exact" : correctResult ? "result" : "wrong",
  };
}

export async function generateCallbackScript(match, predResult) {
  const statusLine = {
    exact:  `WE CALLED IT EXACTLY. ${predResult.predicted}. That's EXACTLY what happened.`,
    result: `We got the result right! We said ${predResult.predicted} — the actual score was ${predResult.actual}.`,
    wrong:  `Okay, we were wrong. We predicted ${predResult.predicted} — the actual result was ${predResult.actual}.`,
  }[predResult.type];

  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 700,
    messages: [{ role: "user", content: `Write a 45-second PREDICTION CALLBACK script for YouTube Shorts.

MATCH: ${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}
OUR PREDICTION WAS: ${predResult.predicted}
ACTUAL RESULT: ${predResult.actual}
STATUS: ${predResult.type.toUpperCase()}

OPENING LINE TO USE: "${statusLine}"

FORMAT:
[OPEN] Use the opening line above verbatim.
[BREAKDOWN] 2 sentences on what we got right/wrong and why.
[HONEST] If wrong, own it. If right, celebrate it. Be real.
[SCORE] "Prediction accuracy: [result/wrong/EXACT SCORE]"
[OUTRO] "Check the prediction video to see what we saw before kickoff. Link above."

Under 130 words. Honest, funny, builds trust.` }],
  });

  const script = msg.content[0].text;
  const emoji = { exact: "🎯", result: "✅", wrong: "❌" }[predResult.type];

  return {
    script, predResult,
    title: `${emoji} Our Prediction vs Reality | ${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name} | WC2026`,
    description: `We predicted ${predResult.predicted}. The actual result was ${predResult.actual}. How did we do? FIFA World Cup 2026.`,
    hashtags: "#FIFAWorldCup2026 #Prediction #WC2026 #Football #DidWeGetItRight",
    videoType: "prediction-callback",
  };
}

export function renderCallbackThumbnail(match, predResult) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const colors = { exact: ["#003300","#004400"], result: ["#002200","#003300"], wrong: ["#1a0000","#2a0000"] };
  const [c1, c2] = colors[predResult.type] || colors.wrong;
  const bg = ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,c1); bg.addColorStop(1,c2);
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

  const accentColor = { exact:"#00ff88", result:"#4caf50", wrong:"#f44336" }[predResult.type];
  ctx.fillStyle = accentColor; ctx.fillRect(0,0,W,7);

  const badge = { exact:"🎯 EXACT SCORE!", result:"✅ CORRECT RESULT", wrong:"❌ WE GOT IT WRONG" }[predResult.type];
  ctx.fillStyle = `${accentColor}22`;
  ctx.beginPath(); ctx.roundRect(W/2-220,16,440,44,6); ctx.fill();
  ctx.fillStyle = accentColor; ctx.font = "bold 22px monospace"; ctx.textAlign = "center";
  ctx.fillText(badge, W/2, 46);

  ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "bold 22px monospace";
  ctx.fillText("WE PREDICTED", W/2, 130);
  ctx.fillStyle = accentColor; ctx.font = "bold 58px monospace";
  ctx.shadowColor = `${accentColor}66`; ctx.shadowBlur = 16;
  ctx.fillText(predResult.predicted.split(" ").slice(1,3).join(" ") || predResult.predicted, W/2, 210);
  ctx.shadowBlur = 0;

  ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(100,240); ctx.lineTo(W-100,240); ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "bold 22px monospace";
  ctx.fillText("ACTUAL RESULT", W/2, 290);
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 68px monospace";
  ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 10;
  ctx.fillText(`${match.home.score} - ${match.away.score}`, W/2, 380);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "bold 26px sans-serif";
  ctx.fillText(`${match.home.name}  vs  ${match.away.name}`, W/2, 430);

  const fade = ctx.createLinearGradient(0,H-160,0,H);
  fade.addColorStop(0,"rgba(0,0,0,0)"); fade.addColorStop(1,"rgba(0,0,0,0.9)");
  ctx.fillStyle = fade; ctx.fillRect(0,0,W,H);

  ctx.fillStyle = "#fff"; ctx.font = "bold 48px sans-serif";
  ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 14;
  ctx.fillText("DID WE CALL IT? 🎯", W/2, H-42);
  ctx.shadowBlur = 0;

  const p = path.join(OUTPUT_DIR, `callback_thumb_${match.id||Date.now()}.png`);
  fs.writeFileSync(p, canvas.toBuffer("image/png"));
  return p;
}
