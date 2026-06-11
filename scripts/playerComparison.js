// scripts/playerComparison.js — Gemini powered
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

const TYPES = ["key-players","top-scorers","captains"];
export function getComparisonType(matchNumber) { return TYPES[matchNumber % TYPES.length]; }

export async function fetchPlayerStats(teamId, type="key-players") {
  const headers = { "x-rapidapi-key":process.env.FOOTBALL_API_KEY, "x-rapidapi-host":"v3.football.api-sports.io" };
  const res = await axios.get("https://v3.football.api-sports.io/players", {
    headers, params:{ team:teamId, season:2026, league:process.env.FOOTBALL_LEAGUE_ID },
  });
  const players = res.data.response;
  const fmt = p => ({
    name:p.player.name, position:p.statistics[0]?.games?.position||"MF",
    goals:p.statistics[0]?.goals?.total||0, assists:p.statistics[0]?.goals?.assists||0,
    appearances:p.statistics[0]?.games?.appearences||0,
    rating:parseFloat(p.statistics[0]?.games?.rating||0).toFixed(1),
    tackles:p.statistics[0]?.tackles?.total||0,
  });
  if (type==="top-scorers") return players.sort((a,b)=>(b.statistics[0]?.goals?.total||0)-(a.statistics[0]?.goals?.total||0)).slice(0,1).map(fmt);
  if (type==="captains")    return players.sort((a,b)=>(b.statistics[0]?.games?.appearences||0)-(a.statistics[0]?.games?.appearences||0)).slice(0,1).map(fmt);
  return players.filter(p=>p.statistics[0]?.games?.rating).sort((a,b)=>parseFloat(b.statistics[0].games.rating)-parseFloat(a.statistics[0].games.rating)).slice(0,1).map(fmt);
}

export async function generateComparisonScript(match, hp, ap, compType) {
  const label = {"key-players":"KEY PLAYER SHOWDOWN","top-scorers":"TOP SCORER BATTLE","captains":"CAPTAIN VS CAPTAIN"}[compType];
  const script = await generate(`You are a FIFA World Cup analyst. Write a 75-second ${label} script.

MATCH: ${match.home.name} vs ${match.away.name}  |  ${match.round}
${match.home.name}: ${hp.name} | Pos:${hp.position} Goals:${hp.goals} Assists:${hp.assists} Rating:${hp.rating}
${match.away.name}: ${ap.name} | Pos:${ap.position} Goals:${ap.goals} Assists:${ap.assists} Rating:${ap.rating}

FORMAT:
[HOOK] Set up the duel in one electrifying sentence.
[PLAYER 1] ${hp.name}'s strengths and tournament impact (2 sentences).
[PLAYER 2] ${ap.name}'s strengths and tournament impact (2 sentences).
[HEAD TO HEAD] Compare stat by stat — who wins each category.
[EDGE] Who has the edge today and why.
[OUTRO] Ask viewers who wins the individual battle.

Under 200 words. Statistical but exciting.`);

  const meta = await generate(`YouTube metadata for ${label}: ${hp.name} vs ${ap.name} FIFA World Cup 2026.
TITLE: (include both names or teams, max 70 chars)
DESCRIPTION: (2-3 sentences)
HASHTAGS: (8 tags)
Format — TITLE: ... DESCRIPTION: ... HASHTAGS: ...`, 300);

  return {
    script,
    title: meta.match(/TITLE:\s*(.+)/)?.[1]?.trim() || `${hp.name} vs ${ap.name} | WC2026`,
    description: meta.match(/DESCRIPTION:\s*([\s\S]+?)(?=HASHTAGS:|$)/)?.[1]?.trim() || script.slice(0,300),
    hashtags: meta.match(/HASHTAGS:\s*(.+)/)?.[1]?.trim() || "#FIFAWorldCup2026",
    videoType:"player-comparison", compType,
  };
}

export function renderComparisonThumbnail(match, hp, ap, compType) {
  fs.mkdirSync(OUTPUT_DIR,{recursive:true});
  const canvas=createCanvas(W,H); const ctx=canvas.getContext("2d");
  ctx.fillStyle="#1a0a00"; ctx.fillRect(0,0,W/2,H);
  ctx.fillStyle="#001020"; ctx.fillRect(W/2,0,W/2,H);
  const ov=ctx.createLinearGradient(0,0,W,0);
  ov.addColorStop(0,"rgba(0,0,0,0.4)"); ov.addColorStop(0.5,"rgba(0,0,0,0)"); ov.addColorStop(1,"rgba(0,0,0,0.4)");
  ctx.fillStyle=ov; ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#ff6600"; ctx.fillRect(0,0,W/2,6);
  ctx.fillStyle="#0066ff"; ctx.fillRect(W/2,0,W/2,6);
  ctx.strokeStyle="rgba(255,255,255,0.12)"; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(W/2,H); ctx.stroke();
  const label={"key-players":"KEY PLAYER","top-scorers":"TOP SCORER","captains":"CAPTAIN"}[compType];
  ctx.fillStyle="rgba(255,255,255,0.08)"; ctx.beginPath(); ctx.roundRect(W/2-160,16,320,40,6); ctx.fill();
  ctx.fillStyle="#d4af37"; ctx.font="bold 17px monospace"; ctx.textAlign="center";
  ctx.fillText(`⚡ ${label} BATTLE`,W/2,42);
  ctx.shadowColor="rgba(0,0,0,0.9)"; ctx.shadowBlur=12;
  ctx.fillStyle="#ff9944"; ctx.font="bold 52px sans-serif";
  ctx.fillText(hp.name.split(" ").pop().toUpperCase(),W/4,180);
  ctx.fillStyle="#44aaff";
  ctx.fillText(ap.name.split(" ").pop().toUpperCase(),W*3/4,180);
  ctx.shadowBlur=0;
  ctx.fillStyle="rgba(255,255,255,0.6)"; ctx.font="bold 28px sans-serif";
  ctx.fillText(match.home.name.toUpperCase(),W/4,218);
  ctx.fillText(match.away.name.toUpperCase(),W*3/4,218);
  const stats=[{label:"GOALS",home:hp.goals,away:ap.goals},{label:"ASSISTS",home:hp.assists,away:ap.assists},{label:"RATING",home:hp.rating,away:ap.rating},{label:"APPS",home:hp.appearances,away:ap.appearances}];
  stats.forEach((s,i)=>{
    const y=278+i*70; const hw=parseFloat(s.home)>=parseFloat(s.away);
    ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillRect(40,y,W-80,56);
    ctx.fillStyle=hw?"#ff9944":"rgba(255,153,68,0.4)"; ctx.font=`bold ${hw?36:28}px monospace`; ctx.textAlign="left"; ctx.fillText(s.home,80,y+36);
    ctx.fillStyle="rgba(255,255,255,0.5)"; ctx.font="bold 20px monospace"; ctx.textAlign="center"; ctx.fillText(s.label,W/2,y+36);
    ctx.fillStyle=!hw?"#44aaff":"rgba(68,170,255,0.4)"; ctx.font=`bold ${!hw?36:28}px monospace`; ctx.textAlign="right"; ctx.fillText(s.away,W-80,y+36);
  });
  ctx.fillStyle="rgba(0,0,0,0.8)"; ctx.beginPath(); ctx.arc(W/2,310,38,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="#d4af37"; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle="#d4af37"; ctx.font="bold 22px monospace"; ctx.textAlign="center"; ctx.fillText("VS",W/2,318);
  const fade=ctx.createLinearGradient(0,H-130,0,H);
  fade.addColorStop(0,"rgba(0,0,0,0)"); fade.addColorStop(1,"rgba(0,0,0,0.88)");
  ctx.fillStyle=fade; ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#fff"; ctx.font="bold 48px sans-serif";
  ctx.shadowColor="rgba(0,0,0,0.95)"; ctx.shadowBlur=14;
  ctx.fillText("WHO COMES OUT ON TOP? ⚡",W/2,H-40); ctx.shadowBlur=0;
  const p=path.join(OUTPUT_DIR,`comparison_thumb_${match.id||Date.now()}.png`);
  fs.writeFileSync(p,canvas.toBuffer("image/png")); return p;
}
 
