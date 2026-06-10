// scripts/preMatchAnalysis.js
// Pre-match analysis video — runs 24hrs before kickoff
// Covers: H2H history, team form, tactical preview

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

export async function fetchPreMatchData(homeTeamId, awayTeamId) {
  const headers = {
    "x-rapidapi-key": process.env.FOOTBALL_API_KEY,
    "x-rapidapi-host": "v3.football.api-sports.io",
  };
  const [h2hRes] = await Promise.all([
    axios.get("https://v3.football.api-sports.io/fixtures/headtohead", {
      headers, params: { h2h: `${homeTeamId}-${awayTeamId}`, last: 10 },
    }),
  ]);
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
  ).join("\n");

  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 1024,
    messages: [{ role: "user", content: `You are a FIFA World Cup analyst. Write a punchy 90-second PRE-MATCH ANALYSIS script.

MATCH: ${match.home.name} vs ${match.away.name}
ROUND: ${match.round}

HEAD TO HEAD (last 5):
${h2hSummary || "First ever meeting"}

FORMAT EXACTLY:
[HOOK] One explosive opening line.
[H2H] 2-3 sentences on historical rivalry. Who dominates?
[FORM] 2 sentences on current tournament form for each team.
[KEY BATTLE] One tactical matchup to watch on the pitch.
[PREDICTION] Bold specific prediction with reasoning (e.g. "2-1 Brazil in extra time").
[OUTRO] Ask viewers to drop their prediction in comments.

Under 220 words. High energy. Gen Z tone.` }],
  });

  const script = msg.content[0].text;
  const metaMsg = await client.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 300,
    messages: [{ role: "user", content: `YouTube metadata for pre-match analysis: ${match.home.name} vs ${match.away.name} FIFA World Cup 2026.
TITLE: (max 70 chars, include PREVIEW or PREDICTION)
DESCRIPTION: (3 sentences SEO-rich)
HASHTAGS: (10 tags)
Format: TITLE: ... DESCRIPTION: ... HASHTAGS: ...` }],
  });

  const meta = metaMsg.content[0].text;
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
  ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  ctx.fillStyle = "#d4af37"; ctx.fillRect(0, 0, W, 6);

  // VS circle
  ctx.fillStyle = "rgba(212,175,55,0.08)";
  ctx.beginPath(); ctx.arc(W/2, H/2-50, 80, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = "#d4af3755"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#d4af37"; ctx.font = "bold 44px monospace"; ctx.textAlign = "center";
  ctx.fillText("VS", W/2, H/2-25);

  ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 12;
  ctx.fillStyle = "#fff"; ctx.font = "bold 60px sans-serif";
  ctx.fillText(match.home.name.toUpperCase(), W/4, H/2-25);
  ctx.fillText(match.away.name.toUpperCase(), W*3/4, H/2-25);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(212,175,55,0.12)";
  ctx.beginPath(); ctx.roundRect(W/2-185,18,370,40,6); ctx.fill();
  ctx.fillStyle = "#d4af37"; ctx.font = "bold 16px monospace";
  ctx.fillText("FIFA WORLD CUP 2026  ·  " + match.round.toUpperCase(), W/2, 44);

  const fade = ctx.createLinearGradient(0,H-160,0,H);
  fade.addColorStop(0,"rgba(0,0,0,0)"); fade.addColorStop(1,"rgba(0,0,0,0.9)");
  ctx.fillStyle = fade; ctx.fillRect(0,0,W,H);

  ctx.fillStyle = "#fff"; ctx.font = "bold 56px sans-serif";
  ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 14;
  ctx.fillText("WHO WINS THIS? 🔥", W/2, H-42);
  ctx.shadowBlur = 0;

  const p = path.join(OUTPUT_DIR, `analysis_thumb_${match.id||Date.now()}.png`);
  fs.writeFileSync(p, canvas.toBuffer("image/png"));
  return p;
}
