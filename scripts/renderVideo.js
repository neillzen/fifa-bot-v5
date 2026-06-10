// scripts/renderVideo.js
// Stage 3: Render an animated scoreboard video using Canvas + FFmpeg

import { createCanvas, loadImage } from "canvas";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRAMES_DIR = path.join(__dirname, "../tmp/frames");
const OUTPUT_DIR = path.join(__dirname, "../tmp/output");

const WIDTH = 1080;
const HEIGHT = 1920; // Vertical for YouTube Shorts

function ensureDirs() {
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function clearFrames() {
  if (fs.existsSync(FRAMES_DIR)) {
    fs.readdirSync(FRAMES_DIR).forEach((f) => fs.unlinkSync(path.join(FRAMES_DIR, f)));
  }
}

// Draw a single frame
function drawFrame(ctx, match, frameNum, totalFrames) {
  const progress = frameNum / totalFrames;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  // ── Background ──────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bgGrad.addColorStop(0, "#060912");
  bgGrad.addColorStop(0.5, "#0d1f3c");
  bgGrad.addColorStop(1, "#060912");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Subtle grid pattern
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for (let x = 0; x < WIDTH; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke();
  }

  // ── Green field at bottom ───────────────────────────────────
  ctx.fillStyle = "#1a5c2a";
  ctx.fillRect(0, HEIGHT - 200, WIDTH, 200);
  ctx.fillStyle = "#166024";
  ctx.fillRect(0, HEIGHT - 190, WIDTH, 10);

  // ── Gold top bar ────────────────────────────────────────────
  const barProgress = easeOut(Math.min(progress * 3, 1));
  ctx.fillStyle = "#d4af37";
  ctx.fillRect(0, 0, WIDTH * barProgress, 8);

  // ── FIFA Badge ──────────────────────────────────────────────
  const badgeAlpha = easeOut(Math.min(progress * 2, 1));
  ctx.globalAlpha = badgeAlpha;
  ctx.fillStyle = "#d4af3722";
  ctx.beginPath();
  ctx.roundRect(WIDTH / 2 - 200, 40, 400, 60, 8);
  ctx.fill();
  ctx.fillStyle = "#d4af37";
  ctx.font = "bold 22px monospace";
  ctx.textAlign = "center";
  ctx.fillText("FIFA WORLD CUP 2026", WIDTH / 2, 80);
  ctx.font = "16px monospace";
  ctx.fillStyle = "#8a9abf";
  ctx.fillText(match.round.toUpperCase(), WIDTH / 2, 115);
  ctx.globalAlpha = 1;

  // ── Team Section ────────────────────────────────────────────
  const teamAlpha = easeOut(Math.min((progress - 0.1) * 3, 1));
  if (teamAlpha > 0) {
    ctx.globalAlpha = Math.max(0, teamAlpha);

    // Home team
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 72px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(match.home.name, WIDTH / 2 - 260, 320);
    ctx.font = "120px sans-serif";
    ctx.fillText("🏳️", WIDTH / 2 - 260, 460);

    // Away team
    ctx.font = "bold 72px sans-serif";
    ctx.fillText(match.away.name, WIDTH / 2 + 260, 320);
    ctx.font = "120px sans-serif";
    ctx.fillText("🏳️", WIDTH / 2 + 260, 460);

    ctx.globalAlpha = 1;
  }

  // ── Score ────────────────────────────────────────────────────
  const scoreAlpha = easeOut(Math.min((progress - 0.2) * 4, 1));
  if (scoreAlpha > 0) {
    ctx.globalAlpha = Math.max(0, scoreAlpha);

    // Score background
    ctx.fillStyle = "#0d1626";
    ctx.beginPath();
    ctx.roundRect(WIDTH / 2 - 200, 490, 400, 160, 16);
    ctx.fill();
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Score numbers
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 120px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${match.home.score} - ${match.away.score}`, WIDTH / 2, 610);

    // FT label
    ctx.fillStyle = "#4caf50";
    ctx.font = "bold 28px monospace";
    ctx.fillText("FULL TIME", WIDTH / 2, 660);

    ctx.globalAlpha = 1;
  }

  // ── Goals List ───────────────────────────────────────────────
  const goalsToShow = Math.floor(
    Math.min((progress - 0.4) * (match.goals.length + 1) * 3, match.goals.length)
  );

  match.goals.slice(0, goalsToShow).forEach((goal, i) => {
    const isHome = goal.team === match.home.name;
    const x = isHome ? 80 : WIDTH - 80;
    const y = 740 + i * 90;

    ctx.fillStyle = "rgba(13,22,38,0.9)";
    ctx.beginPath();
    ctx.roundRect(isHome ? 60 : WIDTH - 500, y - 30, 440, 70, 8);
    ctx.fill();

    ctx.textAlign = isHome ? "left" : "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText(`⚽ ${goal.player}`, x, y + 5);
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 28px monospace";
    ctx.fillText(`${goal.minute}'`, x, y + 40);
  });

  // ── Bottom bar progress ──────────────────────────────────────
  ctx.fillStyle = "#d4af3744";
  ctx.fillRect(0, HEIGHT - 8, WIDTH, 8);
  ctx.fillStyle = "#d4af37";
  ctx.fillRect(0, HEIGHT - 8, WIDTH * progress, 8);
}

export async function renderVideo(match) {
  ensureDirs();
  clearFrames();

  const FPS = 30;
  const DURATION = 8; // 8-second video
  const TOTAL_FRAMES = FPS * DURATION;

  console.log(`🎬 Rendering ${TOTAL_FRAMES} frames at ${FPS}fps...`);

  // Render each frame
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");
    drawFrame(ctx, match, i, TOTAL_FRAMES);

    const framePath = path.join(FRAMES_DIR, `frame_${String(i).padStart(4, "0")}.png`);
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(framePath, buffer);

    if (i % 30 === 0) process.stdout.write(`  Frame ${i}/${TOTAL_FRAMES}\r`);
  }

  console.log("\n✅ Frames rendered. Encoding video with FFmpeg...");

  const outputPath = path.join(
    OUTPUT_DIR,
    `match_${match.id || Date.now()}.mp4`
  );

  // Encode frames → MP4 with FFmpeg
  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(path.join(FRAMES_DIR, "frame_%04d.png"))
      .inputFPS(FPS)
      .videoCodec("libx264")
      .outputOptions([
        "-pix_fmt yuv420p",  // YouTube compatibility
        "-crf 23",           // Quality (lower = better, 23 is good balance)
        "-preset fast",
        "-movflags +faststart", // Web-optimized
      ])
      .size(`${WIDTH}x${HEIGHT}`)
      .fps(FPS)
      .output(outputPath)
      .on("progress", (p) => process.stdout.write(`  Encoding: ${Math.round(p.percent || 0)}%\r`))
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

  console.log(`\n✅ Video saved: ${outputPath}`);
  clearFrames(); // Clean up frames
  return outputPath;
}

// Run standalone to test
if (process.argv[1].includes("renderVideo")) {
  const testMatch = {
    id: "test_001",
    home: { name: "Brazil", score: 3 },
    away: { name: "France", score: 2 },
    round: "Group Stage",
    goals: [
      { player: "Vinicius Jr.", minute: 12, team: "Brazil" },
      { player: "Mbappé", minute: 34, team: "France" },
      { player: "Rodrygo", minute: 56, team: "Brazil" },
    ],
  };

  console.log("🎬 Test rendering video...");
  const output = await renderVideo(testMatch);
  console.log("✅ Done:", output);
}
