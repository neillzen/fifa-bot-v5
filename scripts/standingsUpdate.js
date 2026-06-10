// scripts/standingsUpdate.js
// Posts group standings after every group stage match — very high search volume

import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../tmp/output");
const W = 1080, H = 1350; // Portrait for Shorts
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function fetchGroupStandings(leagueId = 1) {
  const res = await axios.get("https://v3.football.api-sports.io/standings", {
    headers: { "x-rapidapi-key": process.env.FOOTBALL_API_KEY, "x-rapidapi-host": "v3.football.api-sports.io" },
    params: { league: leagueId, season: 2026 },
  });
  return res.data.response[0]?.league?.standings || [];
}

export async function generateStandingsScript(match, standings) {
  // Find the group containing these two teams
  const group = standings.find(g =>
    g.some(t => t.team.name === match.home.name || t.team.name === match.away.name)
  );
  const groupText = group ? group.map(t =>
    `${t.rank}. ${t.team.name} — P:${t.all.played} W:${t.all.win} D:${t.all.draw} L:${t.all.lose} Pts:${t.points}`
  ).join("\n") : "Standings unavailable";

  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 600,
    messages: [{ role: "user", content: `Write a punchy 30-second YouTube Shorts STANDINGS UPDATE script after ${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}.

CURRENT GROUP STANDINGS:
${groupText}

FORMAT:
[HOOK] One line on what this result means for the group.
[STANDINGS] Read out the updated standings dramatically — who's through, who's in danger.
[DRAMA] Who needs what result next? Name the key game.
[OUTRO] "Full bracket link in bio."

Under 100 words. Fast paced.` }],
  });

  const script = msg.content[0].text;
  return {
    script, groupTable: group,
    title: `GROUP STANDINGS UPDATE | ${match.home.name} vs ${match.away.name} | WC2026`,
    description: `Updated World Cup 2026 group standings after ${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}. Who qualifies? Who's eliminated?`,
    hashtags: "#FIFAWorldCup2026 #WorldCupStandings #GroupStage #WC2026",
    videoType: "standings-update",
  };
}

export function renderStandingsThumbnail(match, groupTable) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const canvas = createCanvas(1280, 720);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#060912"; ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = "#d4af37"; ctx.fillRect(0, 0, 1280, 7);

  ctx.fillStyle = "rgba(212,175,55,0.12)";
  ctx.beginPath(); ctx.roundRect(640-180, 16, 360, 44, 6); ctx.fill();
  ctx.fillStyle = "#d4af37"; ctx.font = "bold 18px monospace"; ctx.textAlign = "center";
  ctx.fillText("📊 STANDINGS UPDATE", 640, 46);

  ctx.fillStyle = "#fff"; ctx.font = "bold 38px monospace";
  ctx.fillText(`AFTER: ${match.home.name} ${match.home.score} - ${match.away.score} ${match.away.name}`, 640, 110);

  if (groupTable) {
    groupTable.slice(0, 4).forEach((t, i) => {
      const y = 160 + i * 110;
      const isQualified = i < 2;
      const isEliminated = i === 3 && t.all.played >= 2;

      ctx.fillStyle = isQualified ? "rgba(76,175,80,0.15)" : isEliminated ? "rgba(244,67,54,0.1)" : "rgba(255,255,255,0.04)";
      ctx.beginPath(); ctx.roundRect(40, y, 1200, 90, 8); ctx.fill();

      ctx.fillStyle = isQualified ? "#4caf50" : isEliminated ? "#f44336" : "#d4af37";
      ctx.font = "bold 36px monospace"; ctx.textAlign = "left";
      ctx.fillText(`${t.rank}.`, 70, y + 54);

      ctx.fillStyle = "#fff"; ctx.font = "bold 36px sans-serif";
      ctx.fillText(t.team.name, 130, y + 54);

      ctx.fillStyle = "#d4af37"; ctx.font = "bold 40px monospace"; ctx.textAlign = "right";
      ctx.fillText(`${t.points} pts`, 1200, y + 54);

      ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "22px monospace";
      ctx.fillText(`${t.all.played}P  ${t.all.win}W  ${t.all.draw}D  ${t.all.lose}L  ${t.goalsDiff > 0 ? "+" : ""}${t.goalsDiff}GD`, 800, y + 54);
    });
  }

  const fade = ctx.createLinearGradient(0, 600, 0, 720);
  fade.addColorStop(0, "rgba(0,0,0,0)"); fade.addColorStop(1, "rgba(0,0,0,0.9)");
  ctx.fillStyle = fade; ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = "#4caf50"; ctx.font = "bold 28px monospace"; ctx.textAlign = "left";
  ctx.fillText("✅ QUALIFIED ZONE", 60, 670);
  ctx.fillStyle = "#f44336"; ctx.textAlign = "right";
  ctx.fillText("❌ ELIMINATION ZONE", 1220, 670);

  const p = path.join(OUTPUT_DIR, `standings_thumb_${match.id || Date.now()}.png`);
  fs.writeFileSync(p, canvas.toBuffer("image/png"));
  return p;
}
