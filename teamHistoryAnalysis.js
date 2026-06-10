// scripts/teamHistoryAnalysis.js — Gemini powered
import { generate } from "./ai.js";
import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../tmp/output");
const W = 1280, H = 720;

const WC_TITLES = {
  Brazil:5, Germany:4, Italy:4, Argentina:3, France:2, Uruguay:2,
  England:1, Spain:1, Netherlands:0, Portugal:0, Belgium:0, Croatia:0,
  Morocco:0, Japan:0, USA:0, Mexico:0, Colombia:0, Senegal:0,
};
const BEST_FINISH = {
  Brazil:"5x Champions", Germany:"4x Champions", Italy:"4x Champions",
  Argentina:"3x Champions", France:"2x Champions", Uruguay:"2x Champions",
  England:"1966 Champions", Spain:"2010 Champions", Netherlands:"3x Runners-up",
  Portugal:"3rd Place 2022", Croatia:"2018 Runners-up", Morocco:"2022 4th Place",
};

export async function generateHistoryScript(match) {
  const homeTitles = WC_TITLES[match.home.name] ?? 0;
  const awayTitles = WC_TITLES[match.away.name] ?? 0;

  const script = await generate(`You are a FIFA World Cup historian on YouTube. Write a cinematic 90-second TEAM HISTORY script.

MATCH: ${match.home.name} vs ${match.away.name}  |  ${match.round}
${match.home.name}: ${homeTitles} WC titles | ${BEST_FINISH[match.home.name]||"Tournament participant"}
${match.away.name}: ${awayTitles} WC titles | ${BEST_FINISH[match.away.name]||"Tournament participant"}

FORMAT:
[HOOK] One dramatic line on the historical weight of this matchup.
[${match.home.name.toUpperCase()} LEGACY] 3 sentences: WC history, iconic moments, greatest players.
[${match.away.name.toUpperCase()} LEGACY] 3 sentences: same treatment.
[THE RIVALRY] 2 sentences on what these nations mean to each other historically.
[STAKES] 1 sentence on what's at stake in 2026.
[OUTRO] "Which legacy continues? Comment below."

Under 230 words. Documentary tone.`);

  const meta = await generate(`YouTube metadata for team history video: ${match.home.name} vs ${match.away.name} FIFA World Cup 2026.
TITLE: (include HISTORY or LEGACY, max 70 chars)
DESCRIPTION: (3 sentences, SEO-rich)
HASHTAGS: (10 tags)
Format — TITLE: ... DESCRIPTION: ... HASHTAGS: ...`, 350);

  return {
    script,
    title: meta.match(/TITLE:\s*(.+)/)?.[1]?.trim() || `${match.home.name} vs ${match.away.name} | World Cup History`,
    description: meta.match(/DESCRIPTION:\s*([\s\S]+?)(?=HASHTAGS:|$)/)?.[1]?.trim() || script.slice(0, 300),
    hashtags: meta.match(/HASHTAGS:\s*(.+)/)?.[1]?.trim() || "#FIFAWorldCup2026",
    videoType: "team-history",
  };
}

export function renderHistoryThumbnail(match) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const bg = ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,"#0e0800"); bg.addColorStop(1,"#1a1000");
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
  for(let y=0;y<H;y+=3){ctx.strokeStyle="rgba(255,200,100,0.03)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  const bar=ctx.createLinearGradient(0,0,W,0);
  bar.addColorStop(0,"#8B6914");bar.addColorStop(0.5,"#d4af37");bar.addColorStop(1,"#8B6914");
  ctx.fillStyle=bar;ctx.fillRect(0,0,W,7);
  const glow=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,280);
  glow.addColorStop(0,"rgba(212,175,55,0.12)");glow.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
  ctx.fillStyle="rgba(212,175,55,0.12)";ctx.beginPath();ctx.roundRect(W/2-155,16,310,42,6);ctx.fill();
  ctx.fillStyle="#d4af37";ctx.font="bold 17px monospace";ctx.textAlign="center";
  ctx.fillText("📜 WORLD CUP HISTORY",W/2,46);
  ctx.shadowColor="rgba(0,0,0,0.9)";ctx.shadowBlur=16;
  ctx.fillStyle="#e8c84a";ctx.font="bold 68px sans-serif";
  ctx.fillText(match.home.name.toUpperCase(),W/4,200);
  ctx.fillText(match.away.name.toUpperCase(),W*3/4,200);
  ctx.shadowBlur=0;
  [[WC_TITLES[match.home.name]??0,W/4],[WC_TITLES[match.away.name]??0,W*3/4]].forEach(([t,x])=>{
    ctx.fillStyle="rgba(212,175,55,0.1)";ctx.beginPath();ctx.roundRect(x-110,220,220,90,10);ctx.fill();
    ctx.fillStyle="#d4af37";ctx.font="bold 44px monospace";ctx.textAlign="center";
    ctx.fillText(t>0?"🏆".repeat(Math.min(t,3)):"—",x,270);
    ctx.fillStyle="rgba(255,255,255,0.5)";ctx.font="bold 16px monospace";
    ctx.fillText(t===1?"1 TITLE":t>1?`${t} TITLES`:"0 TITLES",x,296);
  });
  ctx.fillStyle="rgba(212,175,55,0.08)";ctx.beginPath();ctx.arc(W/2,265,50,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#d4af37";ctx.font="bold 26px monospace";ctx.fillText("VS",W/2,273);
  const fade=ctx.createLinearGradient(0,H-180,0,H);
  fade.addColorStop(0,"rgba(0,0,0,0)");fade.addColorStop(1,"rgba(0,0,0,0.92)");
  ctx.fillStyle=fade;ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#fff";ctx.font="bold 52px sans-serif";
  ctx.shadowColor="rgba(0,0,0,0.95)";ctx.shadowBlur=14;
  ctx.fillText("WHOSE LEGACY IS GREATER? 📜",W/2,H-44);ctx.shadowBlur=0;
  const p=path.join(OUTPUT_DIR,`history_thumb_${match.id||Date.now()}.png`);
  fs.writeFileSync(p,canvas.toBuffer("image/png"));
  return p;
}
