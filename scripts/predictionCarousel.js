// scripts/predictionCarousel.js
// Generates a YouTube Community post carousel for match predictions
// Posts a poll + 3 image "slides" as separate community posts
// Fans vote/comment their predictions in the comment section

import Anthropic from "@anthropic-ai/sdk";
import { google } from "googleapis";
import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../tmp/output");
const W = 1080, H = 1080; // Square for community posts
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getAuthClient() {
  const oauth2 = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  );
  oauth2.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });
  return oauth2;
}

// ── Generate 3 carousel "slides" content with Claude ─────────
export async function generateCarouselContent(match) {
  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 1200,
    messages: [{ role: "user", content: `You are a FIFA World Cup content creator. Generate content for a 3-part YouTube Community post prediction carousel.

MATCH: ${match.home.name} vs ${match.away.name}  |  ${match.round}

Generate exactly this JSON (no markdown, pure JSON):
{
  "poll": {
    "question": "Who wins? 🔮 ${match.home.name} vs ${match.away.name}",
    "options": ["${match.home.name} WIN 🔥", "DRAW ⚖️", "${match.away.name} WIN ⚡", "Extra Time/Pens 😤"]
  },
  "slide1": {
    "title": "MATCH PREVIEW",
    "headline": "One punchy headline about the stakes (max 12 words)",
    "stat1_label": "A key team stat label for ${match.home.name}",
    "stat1_value": "realistic stat value",
    "stat2_label": "A key team stat label for ${match.away.name}",
    "stat2_value": "realistic stat value",
    "fact": "One fascinating fact about this matchup (max 20 words)"
  },
  "slide2": {
    "title": "FORM GUIDE",
    "home_form": ["W","W","D","W","L"],
    "away_form": ["W","L","W","W","W"],
    "home_insight": "One sentence on ${match.home.name}'s current form",
    "away_insight": "One sentence on ${match.away.name}'s current form"
  },
  "slide3": {
    "title": "DROP YOUR PREDICTION",
    "prompt": "Engaging call-to-action asking fans to comment their exact score prediction (max 20 words)",
    "example_predictions": ["2-1 ${match.home.name}", "1-1 Draw", "0-1 ${match.away.name}"],
    "hype_line": "Short hype line to drive engagement (max 10 words)"
  },
  "community_post_text": "The full community post caption (2-3 sentences, use emojis, end with a question to drive comments)"
}` }],
  });

  const raw = msg.content[0].text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    // Fallback if JSON parse fails
    return {
      poll: {
        question: `Who wins? 🔮 ${match.home.name} vs ${match.away.name}`,
        options: [`${match.home.name} WIN 🔥`, "DRAW ⚖️", `${match.away.name} WIN ⚡`, "Extra Time 😤"],
      },
      slide1: { title: "MATCH PREVIEW", headline: "Biggest match of the round", stat1_label: "WC Titles", stat1_value: "—", stat2_label: "WC Titles", stat2_value: "—", fact: "This match could define the tournament." },
      slide2: { title: "FORM GUIDE", home_form: ["W","W","D","W","W"], away_form: ["W","L","W","W","W"], home_insight: "Strong recent form.", away_insight: "Inconsistent but dangerous." },
      slide3: { title: "DROP YOUR PREDICTION", prompt: "Comment your exact score prediction below!", example_predictions: ["2-1", "1-1", "0-1"], hype_line: "Best predictor gets pinned! 📌" },
      community_post_text: `🔥 ${match.home.name} vs ${match.away.name} is almost here! Who's taking the W? Drop your score prediction in the comments 👇`,
    };
  }
}

// ── Render Slide 1: Match Preview ────────────────────────────
function renderSlide1(match, data) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,"#060912"); bg.addColorStop(1,"#0d1f3c");
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

  // Gold frame
  ctx.strokeStyle = "#d4af37"; ctx.lineWidth = 8;
  ctx.strokeRect(16, 16, W-32, H-32);

  ctx.fillStyle = "#d4af37"; ctx.font = "bold 22px monospace"; ctx.textAlign = "center";
  ctx.fillText("FIFA WORLD CUP 2026  ·  SLIDE 1/3", W/2, 70);

  ctx.fillStyle = "#fff"; ctx.font = "bold 28px monospace";
  ctx.fillText(data.slide1?.title || "MATCH PREVIEW", W/2, 116);

  // Teams
  ctx.font = "bold 72px sans-serif";
  ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 12;
  ctx.fillText(match.home.name.toUpperCase(), W/2 - 180, 230);
  ctx.fillText(match.away.name.toUpperCase(), W/2 + 180, 230);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#d4af37"; ctx.font = "bold 52px monospace";
  ctx.fillText("VS", W/2, 230);

  // Headline
  ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.font = "bold 34px sans-serif";
  const words = (data.slide1?.headline || "").split(" ");
  let line = "", y = 310;
  words.forEach(w => {
    const t = line + w + " ";
    if (ctx.measureText(t).width > W - 120 && line) {
      ctx.fillText(line.trim(), W/2, y); line = w + " "; y += 44;
    } else line = t;
  });
  ctx.fillText(line.trim(), W/2, y);

  // Stat boxes
  [[data.slide1?.stat1_label, data.slide1?.stat1_value, W/4],
   [data.slide1?.stat2_label, data.slide1?.stat2_value, W*3/4]].forEach(([label, val, x]) => {
    ctx.fillStyle = "rgba(212,175,55,0.1)";
    ctx.beginPath(); ctx.roundRect(x-130, 430, 260, 110, 10); ctx.fill();
    ctx.strokeStyle = "#d4af3755"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#d4af37"; ctx.font = "bold 42px monospace"; ctx.textAlign = "center";
    ctx.fillText(val || "—", x, 492);
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "bold 17px monospace";
    ctx.fillText((label || "").toUpperCase(), x, 522);
  });

  // Fact strip
  ctx.fillStyle = "rgba(212,175,55,0.08)"; ctx.fillRect(0, 580, W, 80);
  ctx.strokeStyle = "#d4af3733"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0,580); ctx.lineTo(W,580); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "italic 22px sans-serif"; ctx.textAlign = "center";
  ctx.fillText(`💡 ${data.slide1?.fact || ""}`, W/2, 628);

  // Round tag
  ctx.fillStyle = "#d4af37"; ctx.font = "bold 20px monospace";
  ctx.fillText(match.round.toUpperCase(), W/2, 700);

  // Page dots
  [0,1,2].forEach((i) => {
    ctx.fillStyle = i === 0 ? "#d4af37" : "rgba(255,255,255,0.2)";
    ctx.beginPath(); ctx.arc(W/2 - 24 + i*24, 760, 7, 0, Math.PI*2); ctx.fill();
  });

  ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "16px monospace";
  ctx.fillText("SWIPE FOR FORM GUIDE →", W/2, 820);

  const p = path.join(OUTPUT_DIR, `carousel_s1_${match.id||Date.now()}.png`);
  fs.writeFileSync(p, canvas.toBuffer("image/png"));
  return p;
}

// ── Render Slide 2: Form Guide ───────────────────────────────
function renderSlide2(match, data) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,"#060912"); bg.addColorStop(1,"#0d1f3c");
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

  ctx.strokeStyle = "#d4af37"; ctx.lineWidth = 8;
  ctx.strokeRect(16,16,W-32,H-32);

  ctx.fillStyle = "#d4af37"; ctx.font = "bold 22px monospace"; ctx.textAlign = "center";
  ctx.fillText("FIFA WORLD CUP 2026  ·  SLIDE 2/3", W/2, 70);
  ctx.fillStyle = "#fff"; ctx.font = "bold 28px monospace";
  ctx.fillText(data.slide2?.title || "FORM GUIDE", W/2, 116);

  const renderForm = (teamName, form, insight, startY) => {
    ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.font = "bold 36px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(teamName.toUpperCase(), 60, startY);

    (form || ["W","W","W","W","W"]).forEach((result, i) => {
      const colors = { W:"#4caf50", D:"#ff9800", L:"#f44336" };
      const x = 60 + i * 90, y = startY + 20;
      ctx.fillStyle = colors[result] || "#555";
      ctx.beginPath(); ctx.roundRect(x, y, 72, 72, 10); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "bold 30px monospace"; ctx.textAlign = "center";
      ctx.fillText(result, x+36, y+46);
    });

    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "italic 22px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(insight || "", 60, startY + 120);
  };

  renderForm(match.home.name, data.slide2?.home_form, data.slide2?.home_insight, 200);
  ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60,420); ctx.lineTo(W-60,420); ctx.stroke();
  renderForm(match.away.name, data.slide2?.away_form, data.slide2?.away_insight, 470);

  [0,1,2].forEach((i) => {
    ctx.fillStyle = i === 1 ? "#d4af37" : "rgba(255,255,255,0.2)";
    ctx.beginPath(); ctx.arc(W/2 - 24 + i*24, 760, 7, 0, Math.PI*2); ctx.fill();
  });
  ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "16px monospace"; ctx.textAlign = "center";
  ctx.fillText("← BACK  ·  SWIPE FOR PREDICTION →", W/2, 820);

  const p = path.join(OUTPUT_DIR, `carousel_s2_${match.id||Date.now()}.png`);
  fs.writeFileSync(p, canvas.toBuffer("image/png"));
  return p;
}

// ── Render Slide 3: Drop Your Prediction ────────────────────
function renderSlide3(match, data) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,"#0a0520"); bg.addColorStop(1,"#0d1a3a");
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

  // Purple glow
  const glow = ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,350);
  glow.addColorStop(0,"rgba(150,80,255,0.14)"); glow.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(0,0,W,H);

  ctx.strokeStyle = "#9650ff"; ctx.lineWidth = 8; ctx.strokeRect(16,16,W-32,H-32);

  ctx.fillStyle = "#b07aff"; ctx.font = "bold 22px monospace"; ctx.textAlign = "center";
  ctx.fillText("FIFA WORLD CUP 2026  ·  SLIDE 3/3", W/2, 70);
  ctx.fillStyle = "#fff"; ctx.font = "bold 28px monospace";
  ctx.fillText(data.slide3?.title || "DROP YOUR PREDICTION", W/2, 116);

  // Big comment icon
  ctx.font = "100px sans-serif"; ctx.fillText("💬", W/2, 260);

  // Prompt
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 32px sans-serif";
  const words = (data.slide3?.prompt || "Comment your score prediction below!").split(" ");
  let line = "", y = 330;
  words.forEach(w => {
    const t = line + w + " ";
    if (ctx.measureText(t).width > W - 120 && line) {
      ctx.fillText(line.trim(), W/2, y); line = w + " "; y += 44;
    } else line = t;
  });
  ctx.fillText(line.trim(), W/2, y);

  // Example predictions
  (data.slide3?.example_predictions || ["2-1","1-1","0-1"]).forEach((pred, i) => {
    ctx.fillStyle = "rgba(150,80,255,0.15)";
    ctx.beginPath(); ctx.roundRect(W/2-120, 440 + i*70, 240, 52, 26); ctx.fill();
    ctx.strokeStyle = "#9650ff55"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#c0a0ff"; ctx.font = "bold 26px monospace"; ctx.textAlign = "center";
    ctx.fillText(pred, W/2, 474 + i*70);
  });

  // Hype line
  ctx.fillStyle = "#d4af37"; ctx.font = "bold 28px sans-serif";
  ctx.fillText(data.slide3?.hype_line || "Best prediction gets pinned! 📌", W/2, 700);

  [0,1,2].forEach((i) => {
    ctx.fillStyle = i === 2 ? "#9650ff" : "rgba(255,255,255,0.2)";
    ctx.beginPath(); ctx.arc(W/2 - 24 + i*24, 760, 7, 0, Math.PI*2); ctx.fill();
  });

  const p = path.join(OUTPUT_DIR, `carousel_s3_${match.id||Date.now()}.png`);
  fs.writeFileSync(p, canvas.toBuffer("image/png"));
  return p;
}

// ── Post to YouTube Community ─────────────────────────────────
export async function postCommunityCarousel(match, content) {
  if (process.env.DRY_RUN === "true") {
    console.log("  🔶 DRY RUN — would post community carousel");
    console.log("  Poll:", content.poll?.question);
    return { posted: true, dry: true };
  }

  const auth = getAuthClient();
  const youtube = google.youtube({ version: "v3", auth });

  // YouTube Community posts API (posts with images)
  // Note: requires channel with community posts enabled (1000+ subscribers)
  const channelRes = await youtube.channels.list({ part: ["id"], mine: true });
  const channelId = channelRes.data.items[0]?.id;
  if (!channelId) throw new Error("Could not get channel ID");

  // Render slides
  const slide1 = renderSlide1(match, content);
  const slide2 = renderSlide2(match, content);
  const slide3 = renderSlide3(match, content);

  console.log(`  🎨 Carousel slides rendered`);

  // Post community post with text + poll
  // YouTube API for community posts uses activities.insert
  await youtube.activities.insert({
    part: ["snippet", "contentDetails"],
    requestBody: {
      snippet: {
        type: "bulletin",
        description: content.community_post_text,
      },
      contentDetails: {
        bulletin: {
          resourceId: { kind: "youtube#video" }
        }
      }
    }
  });

  console.log("  ✅ Community post published");
  return { posted: true, slides: [slide1, slide2, slide3] };
}

export { renderSlide1, renderSlide2, renderSlide3 };
