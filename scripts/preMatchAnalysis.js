// scripts/preMatchAnalysis.js — Gemini powered
import { generate } from "./ai.js";
import axios from "axios";
import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../tmp/output");
const W = 1280, H = 720;

export async function fetchPreMatchData(homeTeamId, awayTeamId) {
  const headers = {
    "x-rapidapi-key": process.env.FOOTBALL_API_KEY,
    "x-rapidapi-host": "v3.football.api-sports.io",
  };
  const h2hRes = await axios.get("https://v3.football.api-sports.io/fixtures/headtohead", {
    headers, params: { h2h: `${homeTeamId}-${awayTeamId}`, last: 10 },
  });
  const h2h = h2hRes.data.response.slice(0, 5).map(m => ({
    date: m.fixture.date.split("T")[0],
    home: m.teams.home.name, away: m.teams.away.name,
    homeScore: m.goals.home, awayScore: m.goals.away,
  }));
  return { h2h };
}

export async function generateAnalysisScript(match, data) {
  const h2hSummary = data.h2h.map(m =>
    `${m.date}: ${m.home} ${m.homeScore}-${m.awayScore} ${m.away}`
  ).join("\n") || "First meeting";

  const script = await generate(`You are a FIFA World Cup analyst. Write a 90-second PRE-MATCH ANALYSIS script.

MATCH: ${match.home.name} vs ${match.away.name}  |  ${match.round}
HEAD TO HEAD (last 5): ${h2hSummary}

FORMAT:
[HOOK] One explosive opening line.
[H2H] 2-3 sentences on historical rivalry.
[FORM] 2 sentences on current form for each team.
[KEY BATTLE] One tactical matchup to watch.
[PREDICTION] Bold specific score prediction with reasoning.
[OUTRO] Ask viewers to drop their prediction.

Under 220 words. High energy. Gen Z tone.`);

  const meta = await generate(`YouTube metadata for pre-match analysis: ${match.home.name} vs ${match.away.name} FIFA World Cup 2026.
TITLE: (max 70 chars, include PREVIEW)
DESCRIPTION: (3 sentences SEO-rich)
HASHTAGS: (10 tags)
Format — TITLE: ... DESCRIPTION: ... HASHTAGS: ...`, 350);

  return {
    script,
    title: meta.match(/TITLE:\s*(.+)/)?.[1]?.trim() || `${match.home.name} vs ${match.away.name} | WC2026 Preview`,
    description: meta.match(/DESCRIPTION:\s*([\s\S]+?)(?=HASHTAGS:|$)/)?.[1]?.trim() || script.slice(0, 300),
    hashtags: meta.match(/HASHTAGS:\s*(.+)/)?.[1]?.trim() || "#FIFAWorldCup2026",
    videoType: "pre-match-analysis",
  };
}

export function renderAnalysisThumbnail(match) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#060e14"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#d4af37"; ctx.fillRect(0, 0, W, 6);
  const glow = ctx.createRadialGradient(W/2,H/2-50,0,W/2,H/2-50,280);
  glow.addColorStop(0,"rgba(212,175,55,0.1)"); glow.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(0,0,W,H);
  ctx.fillStyle="rgba(212,175,55,0.12)"; ctx.beginPath(); ctx.roundRect(W/2-185,16,370,40,6); ctx.fill();
  ctx.fillStyle="#d4af37"; ctx.font="bold 16px monospace"; ctx.textAlign="center";
  ctx.fillText("FIFA WORLD CUP 2026  ·  "+match.round.toUpperCase(),W/2,43);
  ctx.shadowColor="rgba(0,0,0,0.8)"; ctx.shadowBlur=12;
  ctx.fillStyle="#fff"; ctx.font="bold 60px sans-serif";
  ctx.fillText(match.home.name.toUpperCase(),W/4,200);
  ctx.fillText(match.away.name.toUpperCase(),W*3/4,200);
  ctx.shadowBlur=0;
  ctx.fillStyle="rgba(212,175,55,0.08)"; ctx.beginPath(); ctx.arc(W/2,200,55,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="#d4af3766"; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle="#d4af37"; ctx.font="bold 28px monospace"; ctx.fillText("VS",W/2,208);
  const fade=ctx.createLinearGradient(0,H-160,0,H);
  fade.addColorStop(0,"rgba(0,0,0,0)"); fade.addColorStop(1,"rgba(0,0,0,0.9)");
  ctx.fillStyle=fade; ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#fff"; ctx.font="bold 54px sans-serif";
  ctx.shadowColor="rgba(0,0,0,0.95)"; ctx.shadowBlur=14;
  ctx.fillText("WHO WINS THIS? 🔥",W/2,H-42); ctx.shadowBlur=0;
  const p = path.join(OUTPUT_DIR,`analysis_thumb_${match.id||Date.now()}.png`);
  fs.writeFileSync(p, canvas.toBuffer("image/png"));
  return p;
}
