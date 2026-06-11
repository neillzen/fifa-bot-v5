// scripts/underdogNarrative.js — Gemini powered
import { generate } from "./ai.js";
import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../tmp/output");
const W = 1280, H = 720;

const FIFA_RANKINGS = {
  Argentina:1,France:2,England:3,Brazil:4,Belgium:5,Portugal:6,Netherlands:7,Spain:8,
  Germany:9,Croatia:10,Italy:11,Uruguay:12,"United States":13,Mexico:14,Denmark:15,
  Switzerland:16,Japan:17,"South Korea":18,Colombia:19,Senegal:20,Morocco:21,
  Australia:22,Canada:23,Ecuador:24,Poland:26,Serbia:27,Tunisia:29,Ghana:30,
  Cameroon:31,"Saudi Arabia":32,Iran:33,
};

function getRanking(name) { return FIFA_RANKINGS[name]||50; }

export function detectUnderdog(match) {
  const hr=getRanking(match.home.name), ar=getRanking(match.away.name), diff=Math.abs(hr-ar);
  if(diff<15)return null;
  return {
    underdog: hr>ar?match.home:match.away,
    favourite: hr>ar?match.away:match.home,
    underdogRank: Math.max(hr,ar), favouriteRank: Math.min(hr,ar), rankDiff: diff,
  };
}

export function didUnderdogWin(match, info) {
  if(!info)return false;
  const isHome=info.underdog.name===match.home.name;
  return isHome?(match.home.score>match.away.score):(match.away.score>match.home.score);
}

export async function generateUnderdogPreScript(match, info) {
  const script = await generate(`You are a FIFA World Cup storyteller. Write a 75-second UNDERDOG HYPE script.

MATCH: ${match.home.name} vs ${match.away.name}  |  ${match.round}
UNDERDOG: ${info.underdog.name} (FIFA Rank #${info.underdogRank})
FAVOURITE: ${info.favourite.name} (FIFA Rank #${info.favouriteRank})

FORMAT:
[HOOK] One electric opening line framing the impossible mission.
[THE GIANT] 2 sentences on why ${info.favourite.name} is dangerous.
[THE UNDERDOG] 2 sentences why ${info.underdog.name} should NOT be written off.
[GIANT KILLERS] Name 2-3 legendary World Cup upsets — USA 1950, Cameroon 1990, Morocco 2022.
[THE BELIEF] Why THIS could be the upset of 2026.
[OUTRO] "Can ${info.underdog.name} make history? YES or NO 👇"

Under 200 words. Sports movie trailer energy.`);

  const meta = await generate(`YouTube metadata for underdog preview: ${info.underdog.name} vs ${info.favourite.name} FIFA World Cup 2026.
TITLE: (use UNDERDOG/UPSET/CAN THEY?, max 70 chars)
DESCRIPTION: (2-3 dramatic sentences)
HASHTAGS: (8 tags)
Format — TITLE: ... DESCRIPTION: ... HASHTAGS: ...`, 300);

  return {
    script,
    title: meta.match(/TITLE:\s*(.+)/)?.[1]?.trim()||`Can ${info.underdog.name} Cause the UPSET? | WC2026`,
    description: meta.match(/DESCRIPTION:\s*([\s\S]+?)(?=HASHTAGS:|$)/)?.[1]?.trim()||script.slice(0,300),
    hashtags: meta.match(/HASHTAGS:\s*(.+)/)?.[1]?.trim()||"#FIFAWorldCup2026 #Upset",
    videoType:"underdog-pre",
  };
}

export async function generateUnderdogPostScript(match, info) {
  const isHome=info.underdog.name===match.home.name;
  const uScore=isHome?match.home.score:match.away.score;
  const fScore=isHome?match.away.score:match.home.score;

  const script = await generate(`You are a FIFA World Cup commentator losing your mind at a giant upset.

MATCH: ${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}
UPSET: ${info.underdog.name} (#${info.underdogRank}) BEAT ${info.favourite.name} (#${info.favouriteRank})

FORMAT:
[EXPLOSION] One all-caps shock reaction line.
[THE RESULT] State the score dramatically.
[HOW] 2 sentences on how ${info.underdog.name} pulled it off.
[HISTORY] 1 sentence comparing to all-time World Cup upsets.
[REACTION] "The football world just stopped."
[OUTRO] Ask viewers where they rank this in World Cup history.

Under 160 words. Maximum hype.`);

  const meta = await generate(`YouTube metadata for historic upset: ${info.underdog.name} beat ${info.favourite.name} ${uScore}-${fScore} FIFA World Cup 2026.
TITLE: (use SHOCK/UPSET/HISTORY/ELIMINATED, include score, max 70 chars)
DESCRIPTION: (2-3 sentences)
HASHTAGS: (8 tags)
Format — TITLE: ... DESCRIPTION: ... HASHTAGS: ...`, 300);

  return {
    script,
    title: meta.match(/TITLE:\s*(.+)/)?.[1]?.trim()||`${info.underdog.name} SHOCK ${info.favourite.name} | WC2026 UPSET`,
    description: meta.match(/DESCRIPTION:\s*([\s\S]+?)(?=HASHTAGS:|$)/)?.[1]?.trim()||script.slice(0,300),
    hashtags: meta.match(/HASHTAGS:\s*(.+)/)?.[1]?.trim()||"#FIFAWorldCup2026 #Upset",
    videoType:"underdog-post",
  };
}

export function renderUnderdogPreThumbnail(match, info) {
  fs.mkdirSync(OUTPUT_DIR,{recursive:true});
  const canvas=createCanvas(W,H); const ctx=canvas.getContext("2d");
  const bg=ctx.createLinearGradient(0,0,W,H); bg.addColorStop(0,"#0a0500"); bg.addColorStop(1,"#1a0a00");
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  const fire=ctx.createRadialGradient(W/2,H,0,W/2,H,500);
  fire.addColorStop(0,"rgba(255,80,0,0.2)"); fire.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=fire; ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#ff4400"; ctx.fillRect(0,0,W,7);
  ctx.fillStyle="rgba(255,68,0,0.15)"; ctx.beginPath(); ctx.roundRect(W/2-175,16,350,42,6); ctx.fill();
  ctx.fillStyle="#ff6622"; ctx.font="bold 18px monospace"; ctx.textAlign="center";
  ctx.fillText("🔥 CAN THEY CAUSE THE UPSET?",W/2,44);
  ctx.shadowColor="rgba(0,0,0,0.8)"; ctx.shadowBlur=10;
  ctx.fillStyle="rgba(255,255,255,0.45)"; ctx.font="bold 42px sans-serif";
  ctx.fillText(`#${info.favouriteRank} ${info.favourite.name.toUpperCase()}`,W/2,160);
  ctx.fillStyle="rgba(255,255,255,0.2)"; ctx.font="bold 28px monospace"; ctx.fillText("vs",W/2,200); ctx.shadowBlur=0;
  ctx.shadowColor="rgba(255,80,0,0.6)"; ctx.shadowBlur=24;
  ctx.fillStyle="#ff8844"; ctx.font="bold 82px sans-serif"; ctx.fillText(info.underdog.name.toUpperCase(),W/2,310); ctx.shadowBlur=0;
  ctx.fillStyle="rgba(255,68,0,0.15)"; ctx.beginPath(); ctx.roundRect(W/2-100,328,200,44,22); ctx.fill();
  ctx.fillStyle="#ff6622"; ctx.font="bold 20px monospace"; ctx.fillText(`FIFA RANK #${info.underdogRank}`,W/2,356);
  ctx.fillStyle="rgba(255,255,255,0.5)"; ctx.font="italic 22px sans-serif";
  ctx.fillText("Remember Morocco 2022? Japan 2022? Cameroon 1990?",W/2,420);
  const fade=ctx.createLinearGradient(0,H-170,0,H);
  fade.addColorStop(0,"rgba(0,0,0,0)"); fade.addColorStop(1,"rgba(0,0,0,0.92)");
  ctx.fillStyle=fade; ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#fff"; ctx.font="bold 54px sans-serif";
  ctx.shadowColor="rgba(0,0,0,0.95)"; ctx.shadowBlur=14;
  ctx.fillText(`CAN ${info.underdog.name.toUpperCase()} DO IT? 🔥`,W/2,H-42); ctx.shadowBlur=0;
  const p=path.join(OUTPUT_DIR,`underdog_pre_${match.id||Date.now()}.png`);
  fs.writeFileSync(p,canvas.toBuffer("image/png")); return p;
}

export function renderUnderdogPostThumbnail(match, info) {
  fs.mkdirSync(OUTPUT_DIR,{recursive:true});
  const canvas=createCanvas(W,H); const ctx=canvas.getContext("2d");
  const bg=ctx.createLinearGradient(0,0,W,H); bg.addColorStop(0,"#1a0000"); bg.addColorStop(1,"#2a0800");
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  const burst=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,400);
  burst.addColorStop(0,"rgba(255,100,0,0.25)"); burst.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=burst; ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#ff0000"; ctx.fillRect(0,0,W,8);
  ctx.fillStyle="rgba(255,0,0,0.2)"; ctx.beginPath(); ctx.roundRect(W/2-140,16,280,44,6); ctx.fill();
  ctx.fillStyle="#ff4444"; ctx.font="bold 22px monospace"; ctx.textAlign="center"; ctx.fillText("🚨 HISTORIC UPSET",W/2,46);
  const isHome=info.underdog.name===match.home.name;
  const uScore=isHome?match.home.score:match.away.score;
  const fScore=isHome?match.away.score:match.home.score;
  ctx.shadowColor="rgba(0,0,0,0.9)"; ctx.shadowBlur=16;
  ctx.fillStyle="#ff8844"; ctx.font="bold 72px sans-serif"; ctx.fillText(info.underdog.name.toUpperCase(),W/4,200);
  ctx.fillStyle="rgba(255,255,255,0.4)"; ctx.font="bold 48px sans-serif"; ctx.fillText(info.favourite.name.toUpperCase(),W*3/4,200); ctx.shadowBlur=0;
  ctx.fillStyle="rgba(0,0,0,0.8)"; ctx.beginPath(); ctx.roundRect(W/2-175,220,350,160,14); ctx.fill();
  ctx.strokeStyle="#ff4400"; ctx.lineWidth=3; ctx.stroke();
  ctx.fillStyle="#ff6622"; ctx.font="bold 96px monospace";
  ctx.shadowColor="rgba(255,68,0,0.5)"; ctx.shadowBlur=20;
  ctx.fillText(`${uScore} - ${fScore}`,W/2,330); ctx.shadowBlur=0;
  ctx.fillStyle="#ff4444"; ctx.font="bold 20px monospace"; ctx.fillText("FULL TIME",W/2,368);
  ctx.fillStyle="rgba(255,255,255,0.5)"; ctx.font="bold 22px monospace";
  ctx.fillText(`RANK #${info.underdogRank} beats RANK #${info.favouriteRank}`,W/2,430);
  const fade=ctx.createLinearGradient(0,H-170,0,H);
  fade.addColorStop(0,"rgba(0,0,0,0)"); fade.addColorStop(1,"rgba(0,0,0,0.92)");
  ctx.fillStyle=fade; ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#fff"; ctx.font="bold 52px sans-serif";
  ctx.shadowColor="rgba(0,0,0,0.95)"; ctx.shadowBlur=14;
  ctx.fillText(`${info.underdog.name.toUpperCase()} MAKE HISTORY 🚨`,W/2,H-42); ctx.shadowBlur=0;
  const p=path.join(OUTPUT_DIR,`underdog_post_${match.id||Date.now()}.png`);
  fs.writeFileSync(p,canvas.toBuffer("image/png")); return p;
}
