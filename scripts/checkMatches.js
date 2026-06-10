// scripts/checkMatches.js
// Stage 1: Fetch finished World Cup matches from api-football.com
// Checks which matches are done and haven't been posted yet

import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTED_FILE = path.join(__dirname, "../data/posted_matches.json");

// Load already-posted match IDs so we never double-post
function getPostedMatches() {
  try {
    if (!fs.existsSync(POSTED_FILE)) return [];
    return JSON.parse(fs.readFileSync(POSTED_FILE, "utf8"));
  } catch {
    return [];
  }
}

// Save a match ID after posting
export function markAsPosted(matchId) {
  const posted = getPostedMatches();
  if (!posted.includes(matchId)) {
    posted.push(matchId);
    fs.mkdirSync(path.dirname(POSTED_FILE), { recursive: true });
    fs.writeFileSync(POSTED_FILE, JSON.stringify(posted, null, 2));
  }
}

// Fetch all finished matches from today
export async function getFinishedMatches() {
  const today = new Date().toISOString().split("T")[0];

  const response = await axios.get("https://v3.football.api-sports.io/fixtures", {
    headers: {
      "x-rapidapi-key": process.env.FOOTBALL_API_KEY,
      "x-rapidapi-host": "v3.football.api-sports.io",
    },
    params: {
      league: process.env.FOOTBALL_LEAGUE_ID || 1,
      season: process.env.FOOTBALL_SEASON || 2026,
      date: today,
      status: "FT", // Full Time only
    },
  });

  const matches = response.data.response;
  const posted = getPostedMatches();

  // Filter out already-posted matches
  const newMatches = matches.filter((m) => !posted.includes(m.fixture.id));

  return newMatches.map((m) => ({
    id: m.fixture.id,
    date: m.fixture.date,
    round: m.league.round,
    home: {
      name: m.teams.home.name,
      logo: m.teams.home.logo,
      score: m.goals.home,
    },
    away: {
      name: m.teams.away.name,
      logo: m.teams.away.logo,
      score: m.goals.away,
    },
    goals: (m.events || [])
      .filter((e) => e.type === "Goal")
      .map((e) => ({
        team: e.team.name,
        player: e.player.name,
        minute: e.time.elapsed,
        type: e.detail, // "Normal Goal", "Penalty", "Own Goal"
      })),
    stats: m.statistics || [],
  }));
}

// Run standalone to test
if (process.argv[1].includes("checkMatches")) {
  console.log("🔍 Checking for finished World Cup matches...");
  try {
    const matches = await getFinishedMatches();
    if (matches.length === 0) {
      console.log("✅ No new matches to post.");
    } else {
      console.log(`⚽ Found ${matches.length} new match(es):`);
      matches.forEach((m) => {
        console.log(`  ${m.home.name} ${m.home.score} - ${m.away.score} ${m.away.name}`);
      });
    }
  } catch (err) {
    console.error("❌ Error fetching matches:", err.message);
    process.exit(1);
  }
}
