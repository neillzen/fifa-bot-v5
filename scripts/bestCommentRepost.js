// scripts/bestCommentRepost.js — Gemini powered
import { generate } from "./ai.js";
import { google } from "googleapis";
import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../tmp/output");
const W = 1280, H = 720;

function getAuthClient() {
  const oauth2 = new google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET, "urn:ietf:wg:oauth:2.0:oob");
  oauth2.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });
  return oauth2;
}

export async function fetchTopComment(videoId) {
  // Use YouTube API via googleapis if configured, else skip
  if (!process.env.YOUTUBE_REFRESH_TOKEN) return null;
  try {
    const auth = getAuthClient();
    const youtube = google.youtube({ version:"v3", auth });
    const res = await youtube.commentThreads.list({ part:["snippet"], videoId, order:"relevance", maxResults:20 });
    const comments = res.data.items.map(i => ({
      text: i.snippet.topLevelComment.snippet.textDisplay,
      likes: i.snippet.topLevelComment.snippet.likeCount,
      author: i.snippet.topLevelComment.snippet.authorDisplayName,
      replyCount: i.snippet.totalReplyCount,
    }));
    return comments.map(c=>({...c,score:c.likes*2+c.replyCount*5})).sort((a,b)=>b.score-a.score)[0]||null;
  } catch { return null; }
}

export async function generateReactionScript(match, comment) {
  const script = await generate(`You are a hype FIFA World Cup YouTuber. React to this fan comment.

MATCH: ${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}
TOP COMMENT (${comment.likes} likes): "${comment.text}" — @${comment.author}

FORMAT:
[INTRO] "This comment from @${comment.author} went crazy — ${comment.likes} likes!"
[READ] Read the comment naturally.
[REACT] Your hot take — agree, disagree, or go deeper. Be bold.
[ADD ON] One stat or analysis that backs up or destroys the comment.
[OUTRO] Ask viewers if they agree with @${comment.author} or you.

Under 150 words. Conversational. Opinionated.`);

  const meta = await generate(`YouTube metadata for reacting to top comment: ${match.home.name} vs ${match.away.name} World Cup 2026.
TITLE: (reference the reaction, max 70 chars, clickable)
DESCRIPTION: (2 sentences)
HASHTAGS: (8 tags)
Format — TITLE: ... DESCRIPTION: ... HASHTAGS: ...`, 300);

  return {
    script, comment,
    title: meta.match(/TITLE:\s*(.+)/)?.[1]?.trim() || `Reacting to Top Comment | ${match.home.name} vs ${match.away.name}`,
    description: meta.match(/DESCRIPTION:\s*([\s\S]+?)(?=HASHTAGS:|$)/)?.[1]?.trim() || script.slice(0,300),
    hashtags: meta.match(/HASHTAGS:\s*(.+)/)?.[1]?.trim() || "#FIFAWorldCup2026",
    videoType:"comment-reaction",
  };
}

export function renderReactionThumbnail(match, comment) {
  fs.mkdirSync(OUTPUT_DIR,{recursive:true});
  const canvas=createCanvas(W,H); const ctx=canvas.getContext("2d");
  const bg=ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,"#0f0a00"); bg.addColorStop(1,"#1a0f00");
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#ff9900"; ctx.fillRect(0,0,W,6);
  ctx.fillStyle="rgba(255,153,0,0.15)"; ctx.beginPath(); ctx.roundRect(W/2-160,16,320,42,6); ctx.fill();
  ctx.fillStyle="#ff9900"; ctx.font="bold 18px monospace"; ctx.textAlign="center";
  ctx.fillText("💬 BEST COMMENT",W/2,44);
  ctx.fillStyle="rgba(255,255,255,0.5)"; ctx.font="bold 22px monospace";
  ctx.fillText(`${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}  ·  WC2026`,W/2,90);
  ctx.fillStyle="rgba(255,153,0,0.06)"; ctx.beginPath(); ctx.roundRect(60,120,W-120,260,14); ctx.fill();
  ctx.strokeStyle="rgba(255,153,0,0.3)"; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle="rgba(255,153,0,0.25)"; ctx.font="bold 120px serif"; ctx.textAlign="left"; ctx.fillText('"',72,230);
  const words=(comment.text||"").replace(/<[^>]+>/g,"").split(" ");
  ctx.fillStyle="#fff"; ctx.font="bold 28px sans-serif";
  let line="",lineY=170,lineH=38;
  words.forEach(w=>{
    const t=line+w+" ";
    if(ctx.measureText(t).width>W-200&&line){ctx.fillText(line.trim(),120,lineY);line=w+" ";lineY+=lineH;}
    else line=t;
    if(lineY>340)return;
  });
  if(lineY<=340)ctx.fillText(line.trim(),120,lineY);
  ctx.fillStyle="#ff9900"; ctx.font="bold 22px monospace"; ctx.textAlign="left";
  ctx.fillText(`@${comment.author}`,120,390);
  ctx.fillStyle="rgba(255,255,255,0.5)"; ctx.font="20px monospace";
  ctx.fillText(`👍 ${(comment.likes||0).toLocaleString()} likes`,120,418);
  const fade=ctx.createLinearGradient(0,H-160,0,H);
  fade.addColorStop(0,"rgba(0,0,0,0)"); fade.addColorStop(1,"rgba(0,0,0,0.9)");
  ctx.fillStyle=fade; ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#fff"; ctx.font="bold 50px sans-serif"; ctx.textAlign="center";
  ctx.shadowColor="rgba(0,0,0,0.95)"; ctx.shadowBlur=14;
  ctx.fillText("DO YOU AGREE? 👇",W/2,H-42); ctx.shadowBlur=0;
  const p=path.join(OUTPUT_DIR,`reaction_thumb_${match.id||Date.now()}.png`);
  fs.writeFileSync(p,canvas.toBuffer("image/png")); return p;
}
