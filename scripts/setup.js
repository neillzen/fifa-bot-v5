// scripts/setup.js
// Run this once to verify all API connections before going live
// Usage: node scripts/setup.js

import "dotenv/config";
import { generate } from "./ai.js";
import axios from "axios";

async function checkGemini() {
  process.stdout.write("  🤖 Gemini AI... ");
  if (!process.env.GEMINI_API_KEY) { console.log("❌ GEMINI_API_KEY not set"); return false; }
  try {
    const res = await generate("Reply with only the word: CONNECTED", 20);
    console.log(`✅ ${res.trim()}`);
    return true;
  } catch (e) { console.log(`❌ ${e.message}`); return false; }
}

async function checkZernio() {
  process.stdout.write("  📤 Zernio... ");
  if (!process.env.ZERNIO_API_KEY) { console.log("❌ ZERNIO_API_KEY not set"); return false; }
  try {
    const res = await axios.get("https://zernio.com/api/v1/accounts", {
      headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` },
    });
    const accounts = res.data.accounts || [];
    const platforms = accounts.map(a => a.platform).join(", ");
    console.log(`✅ Connected (${accounts.length} accounts: ${platforms || "none yet"})`);
    return true;
  } catch (e) { console.log(`❌ ${e.message}`); return false; }
}

async function checkFootball() {
  process.stdout.write("  ⚽ api-football.com... ");
  if (!process.env.FOOTBALL_API_KEY) { console.log("❌ FOOTBALL_API_KEY not set"); return false; }
  try {
    const res = await axios.get("https://v3.football.api-sports.io/status", {
      headers: { "x-rapidapi-key": process.env.FOOTBALL_API_KEY, "x-rapidapi-host": "v3.football.api-sports.io" },
    });
    const used = res.data.response?.requests?.current || 0;
    const limit = res.data.response?.requests?.limit_day || 100;
    console.log(`✅ Connected (${used}/${limit} requests used today)`);
    return true;
  } catch (e) { console.log(`❌ ${e.message}`); return false; }
}

async function main() {
  console.log("\n🏆 FIFA World Cup Bot v5 — Setup Check\n");
  console.log("Checking all connections...\n");

  const results = await Promise.all([
    checkGemini(),
    checkZernio(),
    checkFootball(),
  ]);

  const allGood = results.every(Boolean);
  console.log("\n" + "─".repeat(40));

  if (allGood) {
    console.log("✅ All systems go! Run npm test to do a dry run.");
  } else {
    console.log("⚠️  Fix the issues above, then re-run: node scripts/setup.js");
    console.log("\nSetup guide:");
    console.log("  Gemini:  https://aistudio.google.com → Get API key");
    console.log("  Zernio:  https://zernio.com → Sign up → Connect accounts");
    console.log("  Football: https://www.api-football.com → Sign up");
  }
}

main().catch(console.error);
