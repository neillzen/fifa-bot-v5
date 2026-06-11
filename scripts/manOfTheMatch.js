import { generate, generateJSON } from "./ai.js";
// scripts/manOfTheMatch.js
// Auto-detects the best player from match stats and generates spotlight video


import axios from "axios";
import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../tmp/output");
const W = 1280, H = 720;


export async function fetchMatchPlayerStats(fixtureId) {
  const res = await axios.get("https://v3.football.api-sports.io/fixtures/players", {
    headers: { "x-rapidapi-key": process.env.FOOTBALL_API_KEY, "x-rapidapi-host": "v3.football.api-sports.io" },
    params: { fixture: fixtureId },
  });

  const teams = res.data.response;
  if (!teams?.length) return null;

  const allPlayers = teams.flatMap(team =>
    team.players.map(p => ({
      name: p.player.name,
      team: team.team.name,
      rating: parseFloat(p.statistics[0]?.games?.rating || 0),
      goals: p.statistics[0]?.goals?.total || 0,
      assists: p.statistics[0]?.goals?.assists || 0,
      passes: p.statistics[0]?.passes?.total || 0,
      passAccuracy: p.statistics[0]?.passes?.accuracy || 0,
      shots: p.statistics[0]?.shots?.total || 0,
      dribbles: p.statistics[0]?.dribbles?.success || 0,
      tackles: p.statistics[0]?.tackles?.total || 0,
      minutesPlayed: p.statistics[0]?.games?.minutes || 0,
    }))
  );

  // Score: rating is main metric, boosted by goals/assists
  const scored = allPlayers
    .filter(p => p.minutesPlayed >= 45)
    .map(p => ({ ...p, motmScore: p.rating + p.goals * 2 + p.assists * 1.5 }))
    .sort((a, b) => b.motmScore - a.motmScore);

  return scored[0] || null;
}

export async function generateMotmScript(match, player) {
  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 800,
    messages: [{ role: "user", content: `Write a 60-second MAN OF THE MATCH spotlight script for YouTube Shorts.

MATCH: ${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}
MAN OF THE MATCH: ${player.name} (${player.team})

STATS:
Rating: ${player.rating} | Goals: ${player.goals} | Assists: ${player.assists}
Passes: ${player.passes} (${player.passAccuracy}% accuracy) | Shots: ${player.shots}
Dribbles: ${player.dribbles} | Tackles: ${player.tackles}

FORMAT:
[HOOK] "One player ran this game. His name? ${player.name}."
[PERFORMANCE] 3 sentences describing his match performance with stats woven in naturally.
[MOMENT] Describe his most important moment — goal, assist, or key defensive play.
[CLASS] One sentence on what makes him special at this World Cup.
[OUTRO] "Is ${player.name} the best player at this World Cup? Drop your MOTM picks below."

Under 170 words. Celebratory, vivid, cinematic.` }],
  });

  const script = msg.content[0].text;
  return {
    script, player,
    title: `${player.name} — MAN OF THE MATCH 🌟 | ${match.home.name} vs ${match.away.name} | WC2026`,
    description: `${player.name} put on a masterclass as ${player.team} faced ${match.home.name === player.team ? match.away.name : match.home.name} at FIFA World Cup 2026. Full match breakdown.`,
    hashtags: `#FIFAWorldCup2026 #ManOfTheMatch #${player.name.replace(/\s/g,"")} #${player.team.replace(/\s/g,"")} #WC2026`,
    videoType: "man-of-the-match",
  };
}

export function renderMotmThumbnail(match, player) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0a0800"); bg.addColorStop(1, "#1a1400");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Star glow
  const glow = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 320);
  glow.addColorStop(0, "rgba(255,215,0,0.18)"); glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  const goldBar = ctx.createLinearGradient(0,0,W,0);
  goldBar.addColorStop(0,"#8B6914"); goldBar.addColorStop(0.5,"#FFD700"); goldBar.addColorStop(1,"#8B6914");
  ctx.fillStyle = goldBar; ctx.fillRect(0, 0, W, 7);

  ctx.fillStyle = "rgba(255,215,0,0.12)";
  ctx.beginPath(); ctx.roundRect(W/2-185, 16, 370, 44, 6); ctx.fill();
  ctx.fillStyle = "#FFD700"; ctx.font = "bold 20px monospace"; ctx.textAlign = "center";
  ctx.fillText("🌟 MAN OF THE MATCH", W/2, 46);

  // Big star
  ctx.font = "100px sans-serif"; ctx.fillText("⭐", W/2, 200);

  ctx.shadowColor = "rgba(255,215,0,0.6)"; ctx.shadowBlur = 24;
  ctx.fillStyle = "#FFD700"; ctx.font = "bold 76px sans-serif";
  ctx.fillText(player.name.toUpperCase(), W/2, 310);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "bold 30px monospace";
  ctx.fillText(player.team.toUpperCase(), W/2, 358);

  // Stat pills
  const stats = [
    { label: "RATING", val: player.rating },
    { label: "GOALS", val: player.goals },
    { label: "ASSISTS", val: player.assists },
  ];
  stats.forEach((s, i) => {
    const x = W/2 - 240 + i * 240;
    ctx.fillStyle = "rgba(255,215,0,0.1)";
    ctx.beginPath(); ctx.roundRect(x-90, 390, 180, 90, 10); ctx.fill();
    ctx.strokeStyle = "#FFD70055"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#FFD700"; ctx.font = "bold 38px monospace"; ctx.textAlign = "center";
    ctx.fillText(s.val, x, 445);
    ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "bold 16px monospace";
    ctx.fillText(s.label, x, 468);
  });

  const fade = ctx.createLinearGradient(0, H-160, 0, H);
  fade.addColorStop(0, "rgba(0,0,0,0)"); fade.addColorStop(1, "rgba(0,0,0,0.9)");
  ctx.fillStyle = fade; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#fff"; ctx.font = "bold 46px sans-serif";
  ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 14;
  ctx.fillText(`${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}  ·  WC2026`, W/2, H-42);
  ctx.shadowBlur = 0;

  const p = path.join(OUTPUT_DIR, `motm_thumb_${match.id || Date.now()}.png`);
  fs.writeFileSync(p, canvas.toBuffer("image/png"));
  return p;
}
