// scripts/playerComparison.js
// Player comparison video — runs 1hr before kickoff
// Rotates: Starting 11 key players / Top scorer / Captain vs Captain

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

// Rotate comparison type per match number
const COMPARISON_TYPES = ["key-players", "top-scorers", "captains"];
export function getComparisonType(matchNumber) {
  return COMPARISON_TYPES[matchNumber % COMPARISON_TYPES.length];
}

// Fetch player stats from API-Football
export async function fetchPlayerStats(teamId, type = "key-players") {
  const headers = {
    "x-rapidapi-key": process.env.FOOTBALL_API_KEY,
    "x-rapidapi-host": "v3.football.api-sports.io",
  };
  const res = await axios.get("https://v3.football.api-sports.io/players", {
    headers,
    params: { team: teamId, season: 2026, league: process.env.FOOTBALL_LEAGUE_ID },
  });

  const players = res.data.response;

  if (type === "top-scorers") {
    return players
      .sort((a, b) => (b.statistics[0]?.goals?.total || 0) - (a.statistics[0]?.goals?.total || 0))
      .slice(0, 1)
      .map(p => formatPlayer(p));
  }

  if (type === "captains") {
    // Return player with most appearances (captain proxy)
    return players
      .sort((a, b) => (b.statistics[0]?.games?.appearences || 0) - (a.statistics[0]?.games?.appearences || 0))
      .slice(0, 1)
      .map(p => formatPlayer(p));
  }

  // key-players: highest rated
  return players
    .filter(p => p.statistics[0]?.games?.rating)
    .sort((a, b) => parseFloat(b.statistics[0].games.rating) - parseFloat(a.statistics[0].games.rating))
    .slice(0, 1)
    .map(p => formatPlayer(p));
}

function formatPlayer(p) {
  const s = p.statistics[0];
  return {
    name: p.player.name,
    age: p.player.age,
    nationality: p.player.nationality,
    position: s?.games?.position || "MF",
    goals: s?.goals?.total || 0,
    assists: s?.goals?.assists || 0,
    appearances: s?.games?.appearences || 0,
    rating: parseFloat(s?.games?.rating || 0).toFixed(1),
    passAccuracy: s?.passes?.accuracy || 0,
    tackles: s?.tackles?.total || 0,
    dribbles: s?.dribbles?.success || 0,
  };
}

// Generate comparison script with Claude
export async function generateComparisonScript(match, homePlayer, awayPlayer, compType) {
  const typeLabel = {
    "key-players": "KEY PLAYER SHOWDOWN",
    "top-scorers": "TOP SCORER BATTLE",
    "captains": "CAPTAIN VS CAPTAIN",
  }[compType];

  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 1024,
    messages: [{ role: "user", content: `You are a FIFA World Cup analyst. Write a 75-second ${typeLabel} video script.

MATCH: ${match.home.name} vs ${match.away.name}  |  ${match.round}

${match.home.name.toUpperCase()} — ${homePlayer.name}
Position: ${homePlayer.position} | Goals: ${homePlayer.goals} | Assists: ${homePlayer.assists}
Rating: ${homePlayer.rating} | Apps: ${homePlayer.appearances}

${match.away.name.toUpperCase()} — ${awayPlayer.name}
Position: ${awayPlayer.position} | Goals: ${awayPlayer.goals} | Assists: ${awayPlayer.assists}
Rating: ${awayPlayer.rating} | Apps: ${awayPlayer.appearances}

FORMAT EXACTLY:
[HOOK] Set up the duel in one electrifying sentence.
[PLAYER 1] ${homePlayer.name}'s strengths and tournament impact (2 sentences).
[PLAYER 2] ${awayPlayer.name}'s strengths and tournament impact (2 sentences).
[HEAD TO HEAD] Compare them stat by stat — who wins each category.
[EDGE] Who has the edge today and why.
[OUTRO] Ask viewers who they think wins the individual battle.

Under 200 words. Punchy. Statistical but exciting.` }],
  });

  const script = msg.content[0].text;
  const metaMsg = await client.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 250,
    messages: [{ role: "user", content: `YouTube metadata for ${typeLabel}: ${homePlayer.name} vs ${awayPlayer.name} FIFA World Cup 2026.
TITLE: (include both player names or team names, max 70 chars)
DESCRIPTION: (2-3 sentences)
HASHTAGS: (8 tags)
Format: TITLE: ... DESCRIPTION: ... HASHTAGS: ...` }],
  });

  const meta = metaMsg.content[0].text;
  return {
    script,
    title: meta.match(/TITLE:\s*(.+)/)?.[1]?.trim() || `${homePlayer.name} vs ${awayPlayer.name} | WC2026`,
    description: meta.match(/DESCRIPTION:\s*([\s\S]+?)(?=HASHTAGS:|$)/)?.[1]?.trim() || script.slice(0, 300),
    hashtags: meta.match(/HASHTAGS:\s*(.+)/)?.[1]?.trim() || "#FIFAWorldCup2026",
    videoType: "player-comparison",
    compType,
  };
}

// Render comparison thumbnail
export function renderComparisonThumbnail(match, homePlayer, awayPlayer, compType) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Split background — orange vs blue
  ctx.fillStyle = "#1a0a00"; ctx.fillRect(0, 0, W/2, H);
  ctx.fillStyle = "#001020"; ctx.fillRect(W/2, 0, W/2, H);

  const ov = ctx.createLinearGradient(0,0,W,0);
  ov.addColorStop(0,"rgba(0,0,0,0.4)"); ov.addColorStop(0.5,"rgba(0,0,0,0)");
  ov.addColorStop(1,"rgba(0,0,0,0.4)");
  ctx.fillStyle = ov; ctx.fillRect(0,0,W,H);

  // Accent
  ctx.fillStyle = "#ff6600"; ctx.fillRect(0,0,W/2,6);
  ctx.fillStyle = "#0066ff"; ctx.fillRect(W/2,0,W/2,6);

  // Divider
  ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(W/2,H); ctx.stroke();

  const typeLabel = { "key-players":"KEY PLAYER", "top-scorers":"TOP SCORER", "captains":"CAPTAIN" }[compType];
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath(); ctx.roundRect(W/2-160,16,320,40,6); ctx.fill();
  ctx.fillStyle = "#d4af37"; ctx.font = "bold 17px monospace"; ctx.textAlign = "center";
  ctx.fillText(`⚡ ${typeLabel} BATTLE`, W/2, 42);

  // Player names
  ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 12;
  ctx.fillStyle = "#ff9944"; ctx.font = "bold 52px sans-serif";
  ctx.fillText(homePlayer.name.split(" ").pop().toUpperCase(), W/4, 180);
  ctx.fillStyle = "#44aaff"; ctx.font = "bold 52px sans-serif";
  ctx.fillText(awayPlayer.name.split(" ").pop().toUpperCase(), W*3/4, 180);
  ctx.shadowBlur = 0;

  // Team names smaller
  ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "bold 28px sans-serif";
  ctx.fillText(match.home.name.toUpperCase(), W/4, 218);
  ctx.fillText(match.away.name.toUpperCase(), W*3/4, 218);

  // Stat boxes
  const stats = [
    { label: "GOALS", home: homePlayer.goals, away: awayPlayer.goals },
    { label: "ASSISTS", home: homePlayer.assists, away: awayPlayer.assists },
    { label: "RATING", home: homePlayer.rating, away: awayPlayer.rating },
    { label: "APPS", home: homePlayer.appearances, away: awayPlayer.appearances },
  ];

  stats.forEach((s, i) => {
    const y = 278 + i * 70;
    const homeWins = parseFloat(s.home) >= parseFloat(s.away);

    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(40, y, W-80, 56);

    ctx.fillStyle = homeWins ? "#ff9944" : "rgba(255,153,68,0.4)";
    ctx.font = `bold ${homeWins?36:28}px monospace`; ctx.textAlign = "left";
    ctx.fillText(s.home, 80, y+36);

    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "bold 20px monospace"; ctx.textAlign = "center";
    ctx.fillText(s.label, W/2, y+36);

    ctx.fillStyle = !homeWins ? "#44aaff" : "rgba(68,170,255,0.4)";
    ctx.font = `bold ${!homeWins?36:28}px monospace`; ctx.textAlign = "right";
    ctx.fillText(s.away, W-80, y+36);
  });

  // VS badge
  ctx.fillStyle = "rgba(0,0,0,0.8)";
  ctx.beginPath(); ctx.arc(W/2, 310, 38, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = "#d4af37"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#d4af37"; ctx.font = "bold 22px monospace"; ctx.textAlign = "center";
  ctx.fillText("VS", W/2, 318);

  const fade = ctx.createLinearGradient(0,H-130,0,H);
  fade.addColorStop(0,"rgba(0,0,0,0)"); fade.addColorStop(1,"rgba(0,0,0,0.88)");
  ctx.fillStyle = fade; ctx.fillRect(0,0,W,H);

  ctx.fillStyle = "#fff"; ctx.font = "bold 48px sans-serif";
  ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 14;
  ctx.fillText("WHO COMES OUT ON TOP? ⚡", W/2, H-40);
  ctx.shadowBlur = 0;

  const p = path.join(OUTPUT_DIR, `comparison_thumb_${match.id||Date.now()}.png`);
  fs.writeFileSync(p, canvas.toBuffer("image/png"));
  return p;
}
