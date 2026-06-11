import { generate, generateJSON } from "./ai.js";
// scripts/dailyRoundup.js
// End-of-day roundup covering ALL matches played that day


import axios from "axios";
import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../tmp/output");
const W = 1280, H = 720;


export async function fetchTodaysMatches() {
  const today = new Date().toISOString().split("T")[0];
  const res = await axios.get("https://v3.football.api-sports.io/fixtures", {
    headers: { "x-rapidapi-key": process.env.FOOTBALL_API_KEY, "x-rapidapi-host": "v3.football.api-sports.io" },
    params: { league: process.env.FOOTBALL_LEAGUE_ID||1, season:2026, date:today, status:"FT" },
  });
  return res.data.response.map(m => ({
    id: m.fixture.id, round: m.league.round,
    home: { name: m.teams.home.name, score: m.goals.home },
    away: { name: m.teams.away.name, score: m.goals.away },
    goals: (m.events||[]).filter(e=>e.type==="Goal").map(e=>({ player:e.player.name, team:e.team.name, minute:e.time.elapsed })),
  }));
}

export async function generateRoundupScript(matches, date) {
  if (!matches.length) return null;

  const summary = matches.map(m =>
    `${m.home.name} ${m.home.score}-${m.away.score} ${m.away.name}`
  ).join(" | ");

  const bestGame = matches.sort((a,b) =>
    (b.home.score+b.away.score) - (a.home.score+a.away.score)
  )[0];

  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 900,
    messages: [{ role: "user", content: `Write a 90-second END OF DAY ROUNDUP script covering all World Cup matches today.

DATE: ${date}
ALL RESULTS: ${summary}
MOST GOALS: ${bestGame.home.name} ${bestGame.home.score}-${bestGame.away.score} ${bestGame.away.name}

FORMAT:
[HOOK] "Here's everything that happened at the World Cup today."
[RESULTS] Cover each match in 1-2 punchy sentences. Score + key moment only.
[BEST MATCH] 3 sentences on the most entertaining game of the day.
[TALKING POINT] One big storyline emerging from today's results.
[TOMORROW] Tease the next big match coming up.
[OUTRO] "Which result shocked YOU the most? Comment below."

Under 240 words. Fast paced. Like a sports news anchor.` }],
  });

  const script = msg.content[0].text;
  return {
    script, matches,
    title: `WORLD CUP DAILY ROUNDUP 📋 ${date} — All Results | WC2026`,
    description: `Everything that happened at FIFA World Cup 2026 on ${date}. All scores, key moments, and talking points in one video.`,
    hashtags: "#FIFAWorldCup2026 #WorldCupRoundup #WC2026 #Football #DailyRoundup",
    videoType: "daily-roundup",
  };
}

export function renderRoundupThumbnail(matches, date) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#060912"; ctx.fillRect(0,0,W,H);
  const glow = ctx.createRadialGradient(W/2,200,0,W/2,200,400);
  glow.addColorStop(0,"rgba(0,100,255,0.12)"); glow.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(0,0,W,H);

  ctx.fillStyle = "#1a6fff"; ctx.fillRect(0,0,W,7);

  ctx.fillStyle = "rgba(26,111,255,0.12)";
  ctx.beginPath(); ctx.roundRect(W/2-210,16,420,44,6); ctx.fill();
  ctx.fillStyle = "#4488ff"; ctx.font = "bold 20px monospace"; ctx.textAlign = "center";
  ctx.fillText(`📋 DAILY ROUNDUP — ${date}`, W/2, 46);

  ctx.fillStyle = "#fff"; ctx.font = "bold 52px sans-serif";
  ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 10;
  ctx.fillText(`${matches.length} MATCH${matches.length>1?"ES":""} TODAY`, W/2, 130);
  ctx.shadowBlur = 0;

  matches.slice(0,4).forEach((m, i) => {
    const y = 170 + i * 100;
    const totalGoals = m.home.score + m.away.score;
    ctx.fillStyle = totalGoals >= 4 ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.04)";
    ctx.beginPath(); ctx.roundRect(40, y, W-80, 82, 8); ctx.fill();

    ctx.fillStyle = "#fff"; ctx.font = "bold 28px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(m.home.name, 70, y+48);
    ctx.textAlign = "right";
    ctx.fillText(m.away.name, W-70, y+48);

    ctx.fillStyle = totalGoals >= 4 ? "#d4af37" : "#fff";
    ctx.font = "bold 36px monospace"; ctx.textAlign = "center";
    ctx.fillText(`${m.home.score} - ${m.away.score}`, W/2, y+50);

    if (totalGoals >= 4) {
      ctx.fillStyle = "#d4af37"; ctx.font = "bold 16px monospace";
      ctx.fillText("🔥 THRILLER", W/2, y+72);
    }
  });

  const fade = ctx.createLinearGradient(0,H-140,0,H);
  fade.addColorStop(0,"rgba(0,0,0,0)"); fade.addColorStop(1,"rgba(0,0,0,0.9)");
  ctx.fillStyle = fade; ctx.fillRect(0,0,W,H);

  ctx.fillStyle = "#fff"; ctx.font = "bold 44px sans-serif";
  ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 14;
  ctx.fillText("EVERYTHING YOU MISSED 📋", W/2, H-42);
  ctx.shadowBlur = 0;

  const p = path.join(OUTPUT_DIR, `roundup_thumb_${Date.now()}.png`);
  fs.writeFileSync(p, canvas.toBuffer("image/png"));
  return p;
}
 
