// scripts/dataLayer.js
// ═══════════════════════════════════════════════════════════════
// DUAL API STRATEGY — Used by BOTH YouTube and Facebook bots
//
// football-data.org  (FD)  → fixtures, schedule, standings, results
//                            Free: 10 req/min, comp code "WC", no key needed for basic
//                            Sign up at football-data.org for auth token (higher limits)
//
// api-football        (AF)  → live events, goals, player stats, lineups
//                            Free: 100 req/day, league=1, season=2026
//
// HOW THEY WORK TOGETHER:
// - FD fetches the schedule (saves AF quota for match-day only)
// - AF fetches live goals + player stats (FD doesn't have this depth)
// - If one API fails, the other acts as fallback automatically
// - Request counts tracked to avoid hitting limits
// ═══════════════════════════════════════════════════════════════

import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(__dirname, "../data/api_cache.json");

// ── Cache layer (avoid duplicate calls within 5 mins) ─────────
function loadCache() { try { return JSON.parse(fs.readFileSync(CACHE_FILE,"utf8")); } catch { return {}; } }
function saveCache(c) { fs.mkdirSync(path.dirname(CACHE_FILE),{recursive:true}); fs.writeFileSync(CACHE_FILE,JSON.stringify(c,null,2)); }
function getCached(key) {
  const c = loadCache();
  const e = c[key];
  if (e && Date.now() - e.timestamp < 5 * 60 * 1000) return e.data;
  return null;
}
function setCache(key, data) {
  const c = loadCache();
  c[key] = { data, timestamp: Date.now() };
  // Keep cache small — only last 100 entries
  const keys = Object.keys(c);
  if (keys.length > 100) delete c[keys[0]];
  saveCache(c);
}

// ── API clients ───────────────────────────────────────────────
const FD_BASE   = "https://api.football-data.org/v4";
const AF_BASE   = "https://v3.football.api-sports.io";
const FD_TOKEN  = process.env.FD_API_TOKEN;    // football-data.org token (optional, higher limits)
const AF_KEY    = process.env.FOOTBALL_API_KEY; // api-football key

function fdHeaders() {
  const h = { "Content-Type": "application/json" };
  if (FD_TOKEN) h["X-Auth-Token"] = FD_TOKEN;
  return h;
}
function afHeaders() {
  return { "x-rapidapi-key": AF_KEY, "x-rapidapi-host": "v3.football.api-sports.io" };
}

// ── Request counter (prevent hitting limits) ──────────────────
const COUNTS_FILE = path.join(__dirname, "../data/api_counts.json");
function loadCounts() { try { return JSON.parse(fs.readFileSync(COUNTS_FILE,"utf8")); } catch { return { fd:0, af:0, date:"" }; } }
function trackCall(api) {
  const c = loadCounts();
  const today = new Date().toISOString().split("T")[0];
  if (c.date !== today) { c.fd=0; c.af=0; c.date=today; }
  c[api]++;
  fs.mkdirSync(path.dirname(COUNTS_FILE),{recursive:true});
  fs.writeFileSync(COUNTS_FILE, JSON.stringify(c,null,2));
  // Warn when approaching limits
  if (api==="af" && c.af >= 90)  console.log(`  ⚠️  AF API: ${c.af}/100 daily calls used`);
  if (api==="fd" && c.fd >= 500) console.log(`  ⚠️  FD API: ${c.fd} calls today`);
}

// ═══════════════════════════════════════════════════════════════
// FOOTBALL-DATA.ORG FUNCTIONS
// Competition code for World Cup = "WC"
// ═══════════════════════════════════════════════════════════════

// Fetch today's WC fixtures from football-data.org
export async function fdGetTodaysMatches() {
  const key = `fd_today_${new Date().toISOString().split("T")[0]}`;
  const cached = getCached(key);
  if (cached) return cached;

  trackCall("fd");
  const res = await axios.get(`${FD_BASE}/competitions/WC/matches`, {
    headers: fdHeaders(),
    params: { dateFrom: new Date().toISOString().split("T")[0], dateTo: new Date().toISOString().split("T")[0] },
  });

  const matches = res.data.matches.map(m => ({
    id:       `fd_${m.id}`,
    fdId:     m.id,
    date:     m.utcDate,
    round:    m.stage || m.group || "Group Stage",
    status:   m.status, // TIMED, IN_PLAY, FINISHED, etc.
    home: {
      name:   m.homeTeam.name,
      score:  m.score?.fullTime?.home ?? null,
    },
    away: {
      name:   m.awayTeam.name,
      score:  m.score?.fullTime?.away ?? null,
    },
    source: "football-data.org",
  }));

  setCache(key, matches);
  return matches;
}

// Fetch upcoming WC fixtures (next N days)
export async function fdGetUpcomingMatches(daysAhead = 7) {
  const today = new Date().toISOString().split("T")[0];
  const future = new Date(Date.now() + daysAhead * 86400000).toISOString().split("T")[0];
  const key = `fd_upcoming_${today}_${daysAhead}`;
  const cached = getCached(key);
  if (cached) return cached;

  trackCall("fd");
  const res = await axios.get(`${FD_BASE}/competitions/WC/matches`, {
    headers: fdHeaders(),
    params: { dateFrom: today, dateTo: future, status: "TIMED,SCHEDULED" },
  });

  const matches = res.data.matches.map(m => ({
    id:    `fd_${m.id}`,
    fdId:  m.id,
    date:  m.utcDate,
    round: m.stage || m.group || "Group Stage",
    home:  { name: m.homeTeam.name, id: m.homeTeam.id },
    away:  { name: m.awayTeam.name, id: m.awayTeam.id },
    source: "football-data.org",
  }));

  setCache(key, matches);
  return matches;
}

// Fetch WC standings from football-data.org
export async function fdGetStandings() {
  const key = "fd_standings";
  const cached = getCached(key);
  if (cached) return cached;

  trackCall("fd");
  const res = await axios.get(`${FD_BASE}/competitions/WC/standings`, {
    headers: fdHeaders(),
  });

  const standings = res.data.standings || [];
  setCache(key, standings);
  return standings;
}

// Fetch H2H between two teams from football-data.org
export async function fdGetH2H(fdMatchId) {
  const key = `fd_h2h_${fdMatchId}`;
  const cached = getCached(key);
  if (cached) return cached;

  trackCall("fd");
  const res = await axios.get(`${FD_BASE}/matches/${fdMatchId}/head2head`, {
    headers: fdHeaders(),
    params: { limit: 5 },
  });

  const h2h = (res.data.matches || []).map(m => ({
    date:      m.utcDate.split("T")[0],
    home:      m.homeTeam.name,
    away:      m.awayTeam.name,
    homeScore: m.score?.fullTime?.home,
    awayScore: m.score?.fullTime?.away,
  }));

  setCache(key, h2h);
  return h2h;
}

// ═══════════════════════════════════════════════════════════════
// API-FOOTBALL FUNCTIONS
// Used for: live goals, player stats, lineups, events
// league=1, season=2026
// ═══════════════════════════════════════════════════════════════

// Fetch finished matches with full events from api-football
export async function afGetFinishedMatches() {
  const today = new Date().toISOString().split("T")[0];
  const key = `af_finished_${today}`;
  const cached = getCached(key);
  if (cached) return cached;

  trackCall("af");
  const res = await axios.get(`${AF_BASE}/fixtures`, {
    headers: afHeaders(),
    params: { league:1, season:2026, date:today, status:"FT" },
  });

  const matches = res.data.response.map(m => ({
    id:    m.fixture.id,
    afId:  m.fixture.id,
    date:  m.fixture.date,
    round: m.league.round,
    home:  { name:m.teams.home.name, id:m.teams.home.id, score:m.goals.home },
    away:  { name:m.teams.away.name, id:m.teams.away.id, score:m.goals.away },
    goals: (m.events||[]).filter(e=>e.type==="Goal").map(e=>({
      team:e.team.name, player:e.player.name, minute:e.time.elapsed, type:e.detail,
    })),
    events: m.events || [],
    source: "api-football",
  }));

  setCache(key, matches);
  return matches;
}

// Fetch player stats for a specific fixture
export async function afGetPlayerStats(fixtureId) {
  const key = `af_players_${fixtureId}`;
  const cached = getCached(key);
  if (cached) return cached;

  trackCall("af");
  const res = await axios.get(`${AF_BASE}/fixtures/players`, {
    headers: afHeaders(),
    params: { fixture: fixtureId },
  });

  const teams = res.data.response || [];
  const allPlayers = teams.flatMap(team =>
    team.players.map(p => ({
      name:        p.player.name,
      team:        team.team.name,
      rating:      parseFloat(p.statistics[0]?.games?.rating || 0),
      goals:       p.statistics[0]?.goals?.total || 0,
      assists:     p.statistics[0]?.goals?.assists || 0,
      appearances: p.statistics[0]?.games?.appearences || 0,
      minutes:     p.statistics[0]?.games?.minutes || 0,
      shots:       p.statistics[0]?.shots?.total || 0,
      passes:      p.statistics[0]?.passes?.total || 0,
      tackles:     p.statistics[0]?.tackles?.total || 0,
    }))
  );

  setCache(key, allPlayers);
  return allPlayers;
}

// Fetch top scorers from api-football
export async function afGetTopScorers() {
  const key = "af_topscorers";
  const cached = getCached(key);
  if (cached) return cached;

  trackCall("af");
  const res = await axios.get(`${AF_BASE}/players/topscorers`, {
    headers: afHeaders(),
    params: { league:1, season:2026 },
  });

  const scorers = res.data.response.slice(0,8).map(p => ({
    name:        p.player.name,
    team:        p.statistics[0]?.team?.name,
    goals:       p.statistics[0]?.goals?.total || 0,
    assists:     p.statistics[0]?.goals?.assists || 0,
    appearances: p.statistics[0]?.games?.appearences || 0,
    rating:      parseFloat(p.statistics[0]?.games?.rating || 0).toFixed(1),
  }));

  setCache(key, scorers);
  return scorers;
}

// ═══════════════════════════════════════════════════════════════
// UNIFIED FUNCTIONS — smart routing between both APIs
// ═══════════════════════════════════════════════════════════════

// Get finished matches — try AF first (has events/goals), fallback to FD
export async function getFinishedMatches() {
  try {
    const matches = await afGetFinishedMatches();
    if (matches.length > 0) return matches;
    console.log("  ℹ️  AF returned 0 matches, trying football-data.org...");
    throw new Error("No matches from AF");
  } catch (e) {
    console.log(`  ⚠️  AF failed (${e.message}), falling back to football-data.org`);
    const fdMatches = await fdGetTodaysMatches();
    return fdMatches.filter(m => m.status === "FINISHED");
  }
}

// Get upcoming matches — use FD (better schedule data, saves AF quota)
export async function getUpcomingMatches(fromH, toH) {
  const now = new Date();
  try {
    // FD: get next 2 days, then filter by time window
    const all = await fdGetUpcomingMatches(2);
    return all.filter(m => {
      const k = new Date(m.date);
      return k >= new Date(now.getTime() + fromH*3600000) && k <= new Date(now.getTime() + toH*3600000);
    });
  } catch (e) {
    console.log(`  ⚠️  FD failed (${e.message}), falling back to api-football`);
    trackCall("af");
    const today = now.toISOString().split("T")[0];
    const res = await axios.get(`${AF_BASE}/fixtures`, {
      headers: afHeaders(),
      params: { league:1, season:2026, date:today, status:"NS" },
    });
    return res.data.response
      .filter(m => { const k=new Date(m.fixture.date); return k>=new Date(now.getTime()+fromH*3600000)&&k<=new Date(now.getTime()+toH*3600000); })
      .map(m => ({ id:m.fixture.id, date:m.fixture.date, round:m.league.round,
        home:{name:m.teams.home.name,id:m.teams.home.id}, away:{name:m.teams.away.name,id:m.teams.away.id} }));
  }
}

// Get standings — use FD (saves AF quota)
export async function getStandings() {
  try {
    return await fdGetStandings();
  } catch (e) {
    console.log(`  ⚠️  FD standings failed, falling back to api-football`);
    trackCall("af");
    const res = await axios.get(`${AF_BASE}/standings`, {
      headers: afHeaders(),
      params: { league:1, season:2026 },
    });
    return res.data.response[0]?.league?.standings || [];
  }
}

// Get H2H — use FD (saves AF quota)
export async function getH2H(match) {
  if (match.fdId) {
    try { return await fdGetH2H(match.fdId); } catch(e) { console.log("  ⚠️  FD H2H failed:", e.message); }
  }
  // Fallback: af h2h
  if (match.home?.id && match.away?.id) {
    try {
      trackCall("af");
      const res = await axios.get(`${AF_BASE}/fixtures/headtohead`, {
        headers: afHeaders(),
        params: { h2h:`${match.home.id}-${match.away.id}`, last:5 },
      });
      return res.data.response.slice(0,5).map(m=>({
        date:m.fixture.date.split("T")[0], home:m.teams.home.name, away:m.teams.away.name,
        homeScore:m.goals.home, awayScore:m.goals.away,
      }));
    } catch(e) { console.log("  ⚠️  AF H2H failed:", e.message); }
  }
  return [];
}

// Get today's results for daily roundup — try both, merge unique
export async function getTodaysResults() {
  const results = [];
  const seen = new Set();

  try {
    const af = await afGetFinishedMatches();
    af.forEach(m => { if(!seen.has(m.id)){seen.add(m.id);results.push(m);} });
  } catch(e) { console.log("  ⚠️  AF today results:", e.message); }

  try {
    const fd = await fdGetTodaysMatches();
    fd.filter(m=>m.status==="FINISHED").forEach(m => { if(!seen.has(m.id)){seen.add(m.id);results.push(m);} });
  } catch(e) { console.log("  ⚠️  FD today results:", e.message); }

  return results;
}

// Get top scorers — AF only (FD doesn't have player stats on free tier)
export async function getTopScorers() {
  return afGetTopScorers();
}

// Get player stats for MOTM — AF only
export async function getMatchPlayerStats(fixtureId) {
  // Only works with AF fixture IDs (not FD IDs)
  if (typeof fixtureId === "string" && fixtureId.startsWith("fd_")) {
    console.log("  ℹ️  Player stats unavailable for FD matches (use AF fixture ID)");
    return [];
  }
  return afGetPlayerStats(fixtureId);
}

// Print API usage summary
export function printApiUsage() {
  const c = loadCounts();
  const today = new Date().toISOString().split("T")[0];
  if (c.date !== today) return;
  console.log(`\n📊 API Usage today — football-data.org: ${c.fd||0} calls | api-football: ${c.af||0}/100 calls`);
}
 
