import { generate, generateJSON } from "./ai.js";
// scripts/varControversy.js
// Detects VAR/controversial moments from match events and generates instant reaction video


import axios from "axios";
import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../tmp/output");
const W = 1280, H = 720;


// Detect controversy from match events
export function detectControversy(match) {
  if (!match.events) return null;

  const controversialEvents = match.events.filter(e =>
    e.type === "Var" ||
    e.detail?.includes("Penalty") ||
    e.detail?.includes("Red Card") ||
    e.detail?.includes("Cancelled Goal") ||
    e.detail?.includes("Penalty confirmed") ||
    e.detail?.includes("Goal cancelled")
  );

  if (controversialEvents.length === 0) return null;

  return {
    events: controversialEvents,
    summary: controversialEvents.map(e =>
      `${e.time.elapsed}' — ${e.type}: ${e.detail} (${e.team?.name})`
    ).join(", "),
  };
}

export async function generateVarScript(match, controversy) {
  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 800,
    messages: [{ role: "user", content: `Write a 60-second VAR CONTROVERSY reaction script for YouTube Shorts.

MATCH: ${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}
CONTROVERSIAL MOMENTS: ${controversy.summary}

FORMAT:
[SIREN] "HOLD ON. Stop everything. We need to talk about what just happened."
[INCIDENT] Describe the controversial moment(s) in vivid detail. What happened?
[TWO SIDES] One sentence for each side of the argument — was it right or wrong?
[HISTORY] Reference one famous VAR/referee controversy from World Cup history.
[VERDICT] Your bold personal take. Don't sit on the fence.
[OUTRO] "Was this the right call? YES or NO in the comments NOW."

Under 170 words. Outraged but fair. Maximum engagement energy.` }],
  });

  const script = msg.content[0].text;
  return {
    script,
    title: `VAR CONTROVERSY 🚨 ${match.home.name} vs ${match.away.name} | Was This RIGHT? | WC2026`,
    description: `VAR drama at FIFA World Cup 2026: ${match.home.name} vs ${match.away.name}. Was the right call made? Full breakdown.`,
    hashtags: "#VAR #FIFAWorldCup2026 #Controversial #Referee #WC2026 #Football",
    videoType: "var-controversy",
  };
}

export function renderVarThumbnail(match, controversy) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#1a0000"; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 350);
  glow.addColorStop(0, "rgba(255,0,0,0.2)"); glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#ff0000"; ctx.fillRect(0, 0, W, 8);

  ctx.fillStyle = "rgba(255,0,0,0.18)";
  ctx.beginPath(); ctx.roundRect(W/2-165, 16, 330, 44, 6); ctx.fill();
  ctx.fillStyle = "#ff4444"; ctx.font = "bold 22px monospace"; ctx.textAlign = "center";
  ctx.fillText("🚨 VAR CONTROVERSY", W/2, 46);

  ctx.shadowColor = "rgba(255,0,0,0.5)"; ctx.shadowBlur = 20;
  ctx.fillStyle = "#ff4444"; ctx.font = "bold 100px sans-serif";
  ctx.fillText("VAR", W/2, 220);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#fff"; ctx.font = "bold 48px sans-serif";
  ctx.fillText(`${match.home.name} vs ${match.away.name}`, W/2, 300);

  ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "bold 26px monospace";
  const summary = controversy.summary.slice(0, 80) + (controversy.summary.length > 80 ? "..." : "");
  ctx.fillText(summary, W/2, 360);

  const fade = ctx.createLinearGradient(0, H-170, 0, H);
  fade.addColorStop(0, "rgba(0,0,0,0)"); fade.addColorStop(1, "rgba(0,0,0,0.92)");
  ctx.fillStyle = fade; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#fff"; ctx.font = "bold 52px sans-serif";
  ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 14;
  ctx.fillText("WAS THIS THE RIGHT CALL? 🚨", W/2, H-42);
  ctx.shadowBlur = 0;

  const p = path.join(OUTPUT_DIR, `var_thumb_${match.id || Date.now()}.png`);
  fs.writeFileSync(p, canvas.toBuffer("image/png"));
  return p;
}
