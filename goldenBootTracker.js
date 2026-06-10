// scripts/goldenBootTracker.js
// Updates top scorers leaderboard after each match day — very searchable

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

export async function fetchTopScorers() {
  const res = await axios.get("https://v3.football.api-sports.io/players/topscorers", {
    headers: { "x-rapidapi-key": process.env.FOOTBALL_API_KEY, "x-rapidapi-host": "v3.football.api-sports.io" },
    params: { league: process.env.FOOTBALL_LEAGUE_ID || 1, season: 2026 },
  });
  return res.data.response.slice(0, 8).map(p => ({
    name: p.player.name,
    nationality: p.player.nationality,
    team: p.statistics[0]?.team?.name,
    goals: p.statistics[0]?.goals?.total || 0,
    assists: p.statistics[0]?.goals?.assists || 0,
    apps: p.statistics[0]?.games?.appearences || 0,
  }));
}

export async function generateGoldenBootScript(scorers, matchDay) {
  const top3 = scorers.slice(0, 3).map((s, i) => `${i+1}. ${s.name} (${s.team}) — ${s.goals} goals`).join("\n");

  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 600,
    messages: [{ role: "user", content: `Write a 45-second GOLDEN BOOT RACE update script for YouTube Shorts.

TOP SCORERS RIGHT NOW:
${top3}

FORMAT:
[HOOK] "The Golden Boot race is getting SPICY. Here's where it stands."
[TOP 3] Hype each of the top 3 scorers in one sentence each.
[DARK HORSE] Mention one player outside top 3 who could still win it.
[HISTORY] Name one iconic Golden Boot winner from past World Cups for context.
[OUTRO] "Who wins the Golden Boot 2026? Drop your pick below 👇"

Under 130 words. Fast, punchy, names every player dramatically.` }],
  });

  const script = msg.content[0].text;
  return {
    script, scorers,
    title: `GOLDEN BOOT RACE 🥾 Top Scorers Update | FIFA World Cup 2026`,
    description: `Who's leading the Golden Boot race at FIFA World Cup 2026? Updated top scorers leaderboard after matchday ${matchDay}.`,
    hashtags: "#GoldenBoot #FIFAWorldCup2026 #TopScorers #WC2026 #Goals",
    videoType: "golden-boot",
  };
}

export function renderGoldenBootThumbnail(scorers) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,"#0a0600"); bg.addColorStop(1,"#1a1000");
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

  const glow = ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,340);
  glow.addColorStop(0,"rgba(255,180,0,0.15)"); glow.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(0,0,W,H);

  const goldBar = ctx.createLinearGradient(0,0,W,0);
  goldBar.addColorStop(0,"#8B6914"); goldBar.addColorStop(0.5,"#FFD700"); goldBar.addColorStop(1,"#8B6914");
  ctx.fillStyle = goldBar; ctx.fillRect(0,0,W,7);

  ctx.fillStyle = "rgba(255,215,0,0.1)";
  ctx.beginPath(); ctx.roundRect(W/2-215,16,430,44,6); ctx.fill();
  ctx.fillStyle = "#FFD700"; ctx.font = "bold 20px monospace"; ctx.textAlign = "center";
  ctx.fillText("🥾 GOLDEN BOOT RACE — WC2026", W/2, 46);

  // Boot emoji large
  ctx.font = "80px sans-serif"; ctx.fillText("🥾", W/2, 160);

  const medals = ["🥇","🥈","🥉"];
  scorers.slice(0,5).forEach((s, i) => {
    const y = 200 + i * 86;
    ctx.fillStyle = i < 3 ? "rgba(255,215,0,0.08)" : "rgba(255,255,255,0.03)";
    ctx.beginPath(); ctx.roundRect(40, y, W-80, 72, 8); ctx.fill();

    ctx.font = i < 3 ? "bold 36px sans-serif" : "28px sans-serif";
    ctx.fillStyle = i < 3 ? "#FFD700" : "rgba(255,255,255,0.5)";
    ctx.textAlign = "left";
    ctx.fillText(`${medals[i] || `${i+1}.`}  ${s.name}`, 70, y+46);

    ctx.fillStyle = i < 3 ? "#FFD700" : "rgba(255,255,255,0.4)";
    ctx.font = i < 3 ? "bold 40px monospace" : "bold 32px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`${s.goals} ⚽`, W-60, y+46);

    ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.font = "20px monospace";
    ctx.fillText(s.team, W-60, y+68);
  });

  const p = path.join(OUTPUT_DIR, `goldboot_thumb_${Date.now()}.png`);
  fs.writeFileSync(p, canvas.toBuffer("image/png"));
  return p;
}
