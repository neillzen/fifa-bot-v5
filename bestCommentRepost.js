// scripts/bestCommentRepost.js
// Best comment repost — runs 24hrs after match video is posted
// Fetches top liked comment, Claude reacts to it, renders reaction card video

import Anthropic from "@anthropic-ai/sdk";
import { google } from "googleapis";
import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../tmp/output");
const W = 1280, H = 720;
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  );
  oauth2Client.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });
  return oauth2Client;
}

// Fetch top liked + most interesting comments
export async function fetchTopComment(videoId) {
  const auth = getAuthClient();
  const youtube = google.youtube({ version: "v3", auth });

  const res = await youtube.commentThreads.list({
    part: ["snippet"],
    videoId,
    order: "relevance", // YouTube sorts by likes + replies
    maxResults: 20,
  });

  const comments = res.data.items.map(item => ({
    text: item.snippet.topLevelComment.snippet.textDisplay,
    likes: item.snippet.topLevelComment.snippet.likeCount,
    author: item.snippet.topLevelComment.snippet.authorDisplayName,
    replyCount: item.snippet.totalReplyCount,
  }));

  // Score: likes * 2 + replies * 5 (replies signal controversy/interest)
  const scored = comments
    .map(c => ({ ...c, score: c.likes * 2 + c.replyCount * 5 }))
    .sort((a, b) => b.score - a.score);

  return scored[0] || null;
}

// Claude reacts to the comment
export async function generateReactionScript(match, comment) {
  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 1024,
    messages: [{ role: "user", content: `You are a hype FIFA World Cup YouTuber. React to this fan comment about the match.

MATCH: ${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}
TOP FAN COMMENT (${comment.likes} likes, ${comment.replyCount} replies):
"${comment.text}"
— @${comment.author}

Write a 45-second reaction script:

[INTRO] "This comment from @${comment.author} went crazy — ${comment.likes} likes!"
[READ] Read the comment naturally, as if discovering it.
[REACT] Your genuine hot take reaction — agree, disagree, or go deeper. Be bold.
[ADD ON] Add one piece of analysis or stat that backs up or destroys the comment.
[OUTRO] Ask viewers if they agree with @${comment.author} or you.

Under 150 words. Conversational. Entertaining. Opinionated.` }],
  });

  const script = msg.content[0].text;
  const metaMsg = await client.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 250,
    messages: [{ role: "user", content: `YouTube metadata for a "reacting to top comment" video about ${match.home.name} vs ${match.away.name} World Cup 2026.
TITLE: (reference the comment or reaction, max 70 chars, make it curious/clickable)
DESCRIPTION: (2 sentences)
HASHTAGS: (8 tags)
Format: TITLE: ... DESCRIPTION: ... HASHTAGS: ...` }],
  });

  const meta = metaMsg.content[0].text;
  return {
    script,
    comment,
    title: meta.match(/TITLE:\s*(.+)/)?.[1]?.trim() || `Reacting to Top Comment | ${match.home.name} vs ${match.away.name}`,
    description: meta.match(/DESCRIPTION:\s*([\s\S]+?)(?=HASHTAGS:|$)/)?.[1]?.trim() || script.slice(0, 300),
    hashtags: meta.match(/HASHTAGS:\s*(.+)/)?.[1]?.trim() || "#FIFAWorldCup2026",
    videoType: "comment-reaction",
  };
}

// Render comment reaction thumbnail
export function renderReactionThumbnail(match, comment, reaction) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Dark warm background
  const bg = ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,"#0f0a00"); bg.addColorStop(1,"#1a0f00");
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

  // Warm glow
  const glow = ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,400);
  glow.addColorStop(0,"rgba(255,150,0,0.08)"); glow.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(0,0,W,H);

  ctx.fillStyle = "#ff9900"; ctx.fillRect(0,0,W,6);

  // "BEST COMMENT" badge
  ctx.fillStyle = "rgba(255,153,0,0.15)";
  ctx.beginPath(); ctx.roundRect(W/2-160,16,320,42,6); ctx.fill();
  ctx.fillStyle = "#ff9900"; ctx.font = "bold 18px monospace"; ctx.textAlign = "center";
  ctx.fillText("💬 BEST COMMENT", W/2, 44);

  // Match title
  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "bold 22px monospace";
  ctx.fillText(`${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}  ·  WC2026`, W/2, 90);

  // Comment card
  ctx.fillStyle = "rgba(255,153,0,0.06)";
  ctx.beginPath(); ctx.roundRect(60, 120, W-120, 260, 14); ctx.fill();
  ctx.strokeStyle = "rgba(255,153,0,0.3)"; ctx.lineWidth = 1.5; ctx.stroke();

  // Quote marks
  ctx.fillStyle = "rgba(255,153,0,0.25)"; ctx.font = "bold 120px serif";
  ctx.textAlign = "left"; ctx.fillText('"', 72, 230);

  // Comment text (word wrap)
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 28px sans-serif";
  const words = comment.text.replace(/<[^>]+>/g, "").split(" ");
  let line = "", lineY = 170, lineH = 38;
  words.forEach(word => {
    const test = line + word + " ";
    if (ctx.measureText(test).width > W - 200 && line) {
      ctx.fillText(line.trim(), 120, lineY);
      line = word + " ";
      lineY += lineH;
    } else { line = test; }
    if (lineY > 340) return;
  });
  if (lineY <= 340) ctx.fillText(line.trim(), 120, lineY);

  // Author + likes
  ctx.fillStyle = "#ff9900"; ctx.font = "bold 22px monospace"; ctx.textAlign = "left";
  ctx.fillText(`@${comment.author}`, 120, 390);
  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "20px monospace";
  ctx.fillText(`👍 ${comment.likes.toLocaleString()} likes  ·  💬 ${comment.replyCount} replies`, 120, 418);

  // Bottom fade + CTA
  const fade = ctx.createLinearGradient(0,H-160,0,H);
  fade.addColorStop(0,"rgba(0,0,0,0)"); fade.addColorStop(1,"rgba(0,0,0,0.9)");
  ctx.fillStyle = fade; ctx.fillRect(0,0,W,H);

  ctx.fillStyle = "#fff"; ctx.font = "bold 50px sans-serif"; ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 14;
  ctx.fillText("DO YOU AGREE? 👇", W/2, H-42);
  ctx.shadowBlur = 0;

  const p = path.join(OUTPUT_DIR, `reaction_thumb_${match.id||Date.now()}.png`);
  fs.writeFileSync(p, canvas.toBuffer("image/png"));
  return p;
}
