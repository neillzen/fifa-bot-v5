// scripts/checkMatches.js — Updated to use dual API dataLayer
// Drop-in replacement for both YouTube and Facebook bots
// Just swap this file in — dataLayer handles all API routing automatically

import {
  getFinishedMatches,
  getUpcomingMatches,
  getStandings,
  getH2H,
  getTodaysResults,
  getTopScorers,
  getMatchPlayerStats,
  printApiUsage,
} from "./dataLayer.js";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTED_FILE = path.join(__dirname, "../data/posted_matches.json");

function getPosted() {
  try { return JSON.parse(fs.readFileSync(POSTED_FILE,"utf8")); } catch { return []; }
}

export function markPosted(id) {
  const posted = getPosted();
  if (!posted.includes(String(id))) {
    posted.push(String(id));
    fs.mkdirSync(path.dirname(POSTED_FILE),{recursive:true});
    fs.writeFileSync(POSTED_FILE, JSON.stringify(posted,null,2));
  }
}

// Re-export everything from dataLayer with posted-match filtering
export async function getNewFinishedMatches() {
  const posted = getPosted();
  const matches = await getFinishedMatches();
  return matches.filter(m => !posted.includes(String(m.id)));
}

// Aliases so existing pipeline code doesn't need to change
export { getUpcomingMatches, getStandings, getH2H, getTodaysResults,
         getTopScorers, getMatchPlayerStats, printApiUsage };

// Standalone test
if (process.argv[1].includes("checkMatches")) {
  console.log("🔍 Testing dual API data layer...\n");

  console.log("📅 Today's matches:");
  const today = await getTodaysResults().catch(e=>{console.log(" AF/FD both failed:",e.message);return[];});
  if(today.length) today.forEach(m=>console.log(`  ${m.home.name} ${m.home.score??'?'}-${m.away.score??'?'} ${m.away.name} [${m.source}]`));
  else console.log("  No finished matches today");

  console.log("\n📡 Upcoming (next 24h):");
  const upcoming = await getUpcomingMatches(0,24).catch(()=>[]);
  if(upcoming.length) upcoming.forEach(m=>console.log(`  ${m.home.name} vs ${m.away.name} @ ${m.date} [${m.source||'FD'}]`));
  else console.log("  No upcoming matches");

  printApiUsage();
}
