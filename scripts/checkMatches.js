// scripts/checkMatches.js — v2 using triple-API dataLayer
import {
  getFinishedMatches, getUpcomingMatches, getStandings,
  getH2H, getTodaysResults, getTopScorers, getMatchPlayerStats, printApiUsage,
} from "./dataLayer.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTED_FILE = path.join(__dirname, "../data/posted_matches.json");

function getPosted() { try { return JSON.parse(fs.readFileSync(POSTED_FILE,"utf8")); } catch { return []; } }

export function markPosted(id) {
  const posted = getPosted();
  const sid = String(id);
  if (!posted.includes(sid)) {
    posted.push(sid);
    fs.mkdirSync(path.dirname(POSTED_FILE),{recursive:true});
    fs.writeFileSync(POSTED_FILE, JSON.stringify(posted,null,2));
  }
}

// KEY FIX: also strips "wc_" and "fd_" prefixed IDs from the posted list
// so matches found by different APIs don't get blocked by each other
export function wasPosted(id) {
  const posted = getPosted();
  const sid = String(id);
  return posted.includes(sid) ||
    posted.includes(sid.replace("wc_","")) ||
    posted.includes(`wc_${sid}`) ||
    posted.includes(sid.replace("fd_","")) ||
    posted.includes(`fd_${sid}`);
}

export async function getNewFinishedMatches() {
  const matches = await getFinishedMatches();
  const newMatches = matches.filter(m => !wasPosted(m.id));
  console.log(`  📋 Total finished: ${matches.length} | New (unposted): ${newMatches.length}`);
  return newMatches;
}

// Re-export everything
export { getUpcomingMatches, getStandings, getH2H, getTodaysResults,
         getTopScorers, getMatchPlayerStats, printApiUsage };

// Standalone test
if (process.argv[1].includes("checkMatches")) {
  console.log("🔍 Testing triple API data layer...\n");
  console.log("📅 Finished matches:");
  const finished = await getNewFinishedMatches().catch(e=>{console.log("Error:",e.message);return[];});
  if(finished.length) finished.forEach(m=>console.log(`  ✅ ${m.home.name} ${m.home.score}-${m.away.score} ${m.away.name} [${m.source}]`));
  else console.log("  No new finished matches");
  console.log("\n📡 Upcoming (next 25h):");
  const upcoming = await getUpcomingMatches(0,25).catch(()=>[]);
  if(upcoming.length) upcoming.forEach(m=>console.log(`  🕒 ${m.home.name} vs ${m.away.name} @ ${m.date}`));
  else console.log("  None");
  printApiUsage();
}
