// scripts/predictionCarousel.js — Gemini powered
import { generateJSON } from "./ai.js";
import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../tmp/output");
const W = 1080, H = 1080;

export async function generateCarouselContent(match) {
  return generateJSON(`Generate a 3-part YouTube Community post prediction carousel for:
MATCH: ${match.home.name} vs ${match.away.name}  |  ${match.round}

Return this exact JSON structure:
{
  "poll": { "question": "Who wins? ${match.home.name} vs ${match.away.name}", "options": ["${match.home.name} WIN 🔥","DRAW ⚖️","${match.away.name} WIN ⚡","Extra Time 😤"] },
  "slide1": { "title":"MATCH PREVIEW","headline":"One punchy headline max 12 words","stat1_label":"Key stat for ${match.home.name}","stat1_value":"value","stat2_label":"Key stat for ${match.away.name}","stat2_value":"value","fact":"One fascinating fact about this matchup max 20 words" },
  "slide2": { "title":"FORM GUIDE","home_form":["W","W","D","W","L"],"away_form":["W","L","W","W","W"],"home_insight":"One sentence on ${match.home.name} form","away_insight":"One sentence on ${match.away.name} form" },
  "slide3": { "title":"DROP YOUR PREDICTION","prompt":"Ask fans to comment exact score max 20 words","example_predictions":["2-1 ${match.home.name}","1-1 Draw","0-1 ${match.away.name}"],"hype_line":"Short hype line max 10 words" },
  "community_post_text":"2-3 sentence caption with emojis ending in a question"
}`, {
    poll: { question:`Who wins? ${match.home.name} vs ${match.away.name}`, options:[`${match.home.name} WIN 🔥`,"DRAW ⚖️",`${match.away.name} WIN ⚡`,"Extra Time 😤"] },
    slide1: { title:"MATCH PREVIEW", headline:"Biggest match of the round", stat1_label:"WC Titles", stat1_value:"—", stat2_label:"WC Titles", stat2_value:"—", fact:"This match could define the tournament." },
    slide2: { title:"FORM GUIDE", home_form:["W","W","D","W","W"], away_form:["W","L","W","W","W"], home_insight:"Strong recent form.", away_insight:"Inconsistent but dangerous." },
    slide3: { title:"DROP YOUR PREDICTION", prompt:"Comment your exact score prediction below!", example_predictions:["2-1","1-1","0-1"], hype_line:"Best prediction gets pinned! 📌" },
    community_post_text:`🔥 ${match.home.name} vs ${match.away.name} is almost here! Drop your prediction 👇`,
  });
}

function drawSlideBase(ctx, title, badge, accentColor="#d4af37") {
  const bg=ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,"#060912"); bg.addColorStop(1,"#0d1f3c");
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle=accentColor; ctx.lineWidth=8; ctx.strokeRect(16,16,W-32,H-32);
  ctx.fillStyle=accentColor; ctx.font="bold 22px monospace"; ctx.textAlign="center";
  ctx.fillText(`FIFA WORLD CUP 2026  ·  ${badge}`,W/2,70);
  ctx.fillStyle="#fff"; ctx.font="bold 28px monospace"; ctx.fillText(title,W/2,116);
}

export function renderSlide1(match, data) {
  fs.mkdirSync(OUTPUT_DIR,{recursive:true});
  const canvas=createCanvas(W,H); const ctx=canvas.getContext("2d");
  drawSlideBase(ctx,data.slide1?.title||"MATCH PREVIEW","SLIDE 1/3");
  ctx.shadowColor="rgba(0,0,0,0.8)"; ctx.shadowBlur=12;
  ctx.fillStyle="#fff"; ctx.font="bold 52px sans-serif"; ctx.textAlign="center";
  ctx.fillText(match.home.name.toUpperCase(),W/2-170,230);
  ctx.fillText(match.away.name.toUpperCase(),W/2+170,230);
  ctx.fillStyle="#d4af37"; ctx.font="bold 40px monospace"; ctx.fillText("VS",W/2,230);
  ctx.shadowBlur=0;
  ctx.fillStyle="rgba(255,255,255,0.9)"; ctx.font="bold 32px sans-serif";
  ctx.fillText(data.slide1?.headline||"",W/2,310);
  [[data.slide1?.stat1_label,data.slide1?.stat1_value,W/4],[data.slide1?.stat2_label,data.slide1?.stat2_value,W*3/4]].forEach(([l,v,x])=>{
    ctx.fillStyle="rgba(212,175,55,0.1)"; ctx.beginPath(); ctx.roundRect(x-130,430,260,110,10); ctx.fill();
    ctx.fillStyle="#d4af37"; ctx.font="bold 42px monospace"; ctx.fillText(v||"—",x,490);
    ctx.fillStyle="rgba(255,255,255,0.5)"; ctx.font="bold 17px monospace"; ctx.fillText((l||"").toUpperCase(),x,520);
  });
  ctx.fillStyle="rgba(212,175,55,0.08)"; ctx.fillRect(0,580,W,80);
  ctx.fillStyle="rgba(255,255,255,0.7)"; ctx.font="italic 22px sans-serif";
  ctx.fillText(`💡 ${data.slide1?.fact||""}`,W/2,628);
  [0,1,2].forEach(i=>{ctx.fillStyle=i===0?"#d4af37":"rgba(255,255,255,0.2)"; ctx.beginPath(); ctx.arc(W/2-24+i*24,760,7,0,Math.PI*2); ctx.fill();});
  ctx.fillStyle="rgba(255,255,255,0.4)"; ctx.font="16px monospace"; ctx.fillText("SWIPE FOR FORM GUIDE →",W/2,820);
  const p=path.join(OUTPUT_DIR,`carousel_s1_${match.id||Date.now()}.png`);
  fs.writeFileSync(p,canvas.toBuffer("image/png")); return p;
}

export function renderSlide2(match, data) {
  fs.mkdirSync(OUTPUT_DIR,{recursive:true});
  const canvas=createCanvas(W,H); const ctx=canvas.getContext("2d");
  drawSlideBase(ctx,data.slide2?.title||"FORM GUIDE","SLIDE 2/3");
  const renderForm=(name,form,insight,startY)=>{
    ctx.fillStyle="rgba(255,255,255,0.9)"; ctx.font="bold 36px sans-serif"; ctx.textAlign="left";
    ctx.fillText(name.toUpperCase(),60,startY);
    (form||["W","W","W","W","W"]).forEach((r,i)=>{
      const colors={W:"#4caf50",D:"#ff9800",L:"#f44336"};
      const x=60+i*90,y=startY+20;
      ctx.fillStyle=colors[r]||"#555"; ctx.beginPath(); ctx.roundRect(x,y,72,72,10); ctx.fill();
      ctx.fillStyle="#fff"; ctx.font="bold 30px monospace"; ctx.textAlign="center"; ctx.fillText(r,x+36,y+46);
    });
    ctx.fillStyle="rgba(255,255,255,0.6)"; ctx.font="italic 22px sans-serif"; ctx.textAlign="left";
    ctx.fillText(insight||"",60,startY+120);
  };
  renderForm(match.home.name,data.slide2?.home_form,data.slide2?.home_insight,200);
  ctx.strokeStyle="rgba(255,255,255,0.08)"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(60,420); ctx.lineTo(W-60,420); ctx.stroke();
  renderForm(match.away.name,data.slide2?.away_form,data.slide2?.away_insight,470);
  [0,1,2].forEach(i=>{ctx.fillStyle=i===1?"#d4af37":"rgba(255,255,255,0.2)"; ctx.beginPath(); ctx.arc(W/2-24+i*24,760,7,0,Math.PI*2); ctx.fill();});
  ctx.fillStyle="rgba(255,255,255,0.4)"; ctx.font="16px monospace"; ctx.textAlign="center"; ctx.fillText("← BACK  ·  SWIPE FOR PREDICTION →",W/2,820);
  const p=path.join(OUTPUT_DIR,`carousel_s2_${match.id||Date.now()}.png`);
  fs.writeFileSync(p,canvas.toBuffer("image/png")); return p;
}

export function renderSlide3(match, data) {
  fs.mkdirSync(OUTPUT_DIR,{recursive:true});
  const canvas=createCanvas(W,H); const ctx=canvas.getContext("2d");
  drawSlideBase(ctx,data.slide3?.title||"DROP YOUR PREDICTION","SLIDE 3/3","#9650ff");
  const glow=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,350);
  glow.addColorStop(0,"rgba(150,80,255,0.14)"); glow.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=glow; ctx.fillRect(0,0,W,H);
  ctx.font="100px sans-serif"; ctx.textAlign="center"; ctx.fillText("💬",W/2,260);
  ctx.fillStyle="#fff"; ctx.font="bold 32px sans-serif";
  const words=(data.slide3?.prompt||"Comment your score below!").split(" ");
  let line="",y=330;
  words.forEach(w=>{const t=line+w+" ";if(ctx.measureText(t).width>W-120&&line){ctx.fillText(line.trim(),W/2,y);line=w+" ";y+=44;}else line=t;});
  ctx.fillText(line.trim(),W/2,y);
  (data.slide3?.example_predictions||["2-1","1-1","0-1"]).forEach((pred,i)=>{
    ctx.fillStyle="rgba(150,80,255,0.15)"; ctx.beginPath(); ctx.roundRect(W/2-120,440+i*70,240,52,26); ctx.fill();
    ctx.strokeStyle="#9650ff55"; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle="#c0a0ff"; ctx.font="bold 26px monospace"; ctx.fillText(pred,W/2,474+i*70);
  });
  ctx.fillStyle="#d4af37"; ctx.font="bold 28px sans-serif"; ctx.fillText(data.slide3?.hype_line||"Best prediction gets pinned! 📌",W/2,700);
  [0,1,2].forEach(i=>{ctx.fillStyle=i===2?"#9650ff":"rgba(255,255,255,0.2)"; ctx.beginPath(); ctx.arc(W/2-24+i*24,760,7,0,Math.PI*2); ctx.fill();});
  const p=path.join(OUTPUT_DIR,`carousel_s3_${match.id||Date.now()}.png`);
  fs.writeFileSync(p,canvas.toBuffer("image/png")); return p;
}

export async function postCommunityCarousel(match, content) {
  // Called by masterPipeline — actual posting handled by publisher.js
  return { content, slides: "rendered" };
}
