// scripts/dataLayer.js  — v2
// THREE API SOURCES working together:
//
//  [1] worldcup26.ir    — FREE, no key, WC2026 only, real-time
//  [2] football-data.org — FREE token, WC code "WC", schedule + standings
//  [3] api-football      — FREE 100/day, live events + player stats
//
// ROUTING:
//  Finished matches  → [1] worldcup26.ir first → [3] AF fallback
//  Upcoming fixtures → [1] worldcup26.ir first → [2] FD fallback
//  Standings         → [1] worldcup26.ir first → [2] FD fallback
//  Goals/events      → [3] AF only (best data)
//  Player stats      → [3] AF only
//  Top scorers       → [3] AF only
//  H2H               → [2] FD first → [3] AF fallback

import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Cache (5 min TTL) ─────────────────────────────────────────
const CACHE_FILE = path.join(__dirname, "../data/api_cache.json");
function loadCache() { try { return JSON.parse(fs.readFileSync(CACHE_FILE,"utf8")); } catch { return {}; } }
function saveCache(c) { fs.mkdirSync(path.dirname(CACHE_FILE),{recursive:true}); fs.writeFileSync(CACHE_FILE,JSON.stringify(c)); }
function getCached(k) { const c=loadCache(),e=c[k]; return (e&&Date.now()-e.t<300000)?e.d:null; }
function setCache(k,d) { const c=loadCache(); c[k]={d,t:Date.now()}; const keys=Object.keys(c); if(keys.length>100)delete c[keys[0]]; saveCache(c); }

// ── API call tracker ──────────────────────────────────────────
const COUNTS_FILE = path.join(__dirname, "../data/api_counts.json");
function trackCall(api) {
  let c; try{c=JSON.parse(fs.readFileSync(COUNTS_FILE,"utf8"));}catch{c={fd:0,af:0,wc:0,date:""};}
  const today=new Date().toISOString().split("T")[0];
  if(c.date!==today){c.fd=0;c.af=0;c.wc=0;c.date=today;}
  c[api]=(c[api]||0)+1;
  fs.mkdirSync(path.dirname(COUNTS_FILE),{recursive:true});
  fs.writeFileSync(COUNTS_FILE,JSON.stringify(c));
  if(api==="af"&&c.af>=85) console.log(`  ⚠️  AF: ${c.af}/100 daily calls used`);
}

// ── Base URLs ─────────────────────────────────────────────────
const WC_BASE = "https://worldcup26.ir";   // No auth needed
const FD_BASE = "https://api.football-data.org/v4";
const AF_BASE = "https://v3.football.api-sports.io";

function fdHeaders() {
  const h = {};
  if (process.env.FD_API_TOKEN) h["X-Auth-Token"] = process.env.FD_API_TOKEN;
  return h;
}
function afHeaders() {
  return { "x-rapidapi-key":process.env.FOOTBALL_API_KEY, "x-rapidapi-host":"v3.football.api-sports.io" };
}

// ══════════════════════════════════════════════════════════════
// [1] worldcup26.ir  — PRIMARY SOURCE, no key required
// ══════════════════════════════════════════════════════════════

// Get WC auth token (free signup at worldcup26.ir)
let wcToken = null;
async function getWcToken() {
  if (wcToken) return wcToken;
  if (!process.env.WC26_EMAIL || !process.env.WC26_PASSWORD) return null;
  try {
    const res = await axios.post(`${WC_BASE}/auth/login`, {
      email: process.env.WC26_EMAIL,
      password: process.env.WC26_PASSWORD,
    });
    wcToken = res.data.token;
    return wcToken;
  } catch { return null; }
}

async function wcGet(endpoint) {
  const token = await getWcToken();
  const headers = token ? { Authorization:`Bearer ${token}` } : {};
  const res = await axios.get(`${WC_BASE}${endpoint}`, { headers, timeout: 8000 });
  return res.data;
}

// Get all WC2026 matches (with optional status filter)
async function wcGetMatches(statusFilter = null) {
  const key = `wc_matches_${statusFilter||"all"}`;
  const cached = getCached(key);
  if (cached) return cached;

  trackCall("wc");
  const data = await wcGet("/get/games");
  let matches = (data.games || data || []);

  // Normalize to standard format
  matches = matches.map(m => ({
    id:      `wc_${m.id || m.match_id}`,
    wcId:    m.id || m.match_id,
    date:    m.datetime || m.date || m.kickoff,
    round:   m.stage || m.round || m.group || "Group Stage",
    status:  m.status || "SCHEDULED",
    home: {
      name:  m.home_team || m.homeTeam?.name || m.home,
      score: m.home_score ?? m.homeScore ?? null,
      id:    m.home_team_id || null,
    },
    away: {
      name:  m.away_team || m.awayTeam?.name || m.away,
      score: m.away_score ?? m.awayScore ?? null,
      id:    m.away_team_id || null,
    },
    goals: (m.goals || m.events || []).filter(e =>
      e.type==="goal"||e.type==="Goal"||e.event_type==="goal"
    ).map(e => ({
      team:   e.team_name || e.team,
      player: e.player_name || e.player,
      minute: e.minute || e.time,
      type:   e.detail || "Normal Goal",
    })),
    events: m.events || [],
    source: "worldcup26.ir",
  }));

  if (statusFilter) {
    const sf = statusFilter.toLowerCase();
    matches = matches.filter(m => {
      const s = (m.status||"").toLowerCase();
      if (sf==="finished") return s==="finished"||s==="ft"||s==="completed"||s==="full_time";
      if (sf==="upcoming") return s==="scheduled"||s==="timed"||s==="upcoming"||s==="ns";
      return true;
    });
  }

  setCache(key, matches);
  return matches;
}

// Get WC2026 standings from worldcup26.ir
async function wcGetStandings() {
  const key = "wc_standings";
  const cached = getCached(key);
  if (cached) return cached;

  trackCall("wc");
  const data = await wcGet("/get/groups");
  setCache(key, data);
  return data;
}

// ══════════════════════════════════════════════════════════════
// [2] football-data.org  — SECONDARY SOURCE
// ══════════════════════════════════════════════════════════════

async function fdGetMatches(dateFrom, dateTo, status = null) {
  const key = `fd_${dateFrom}_${dateTo}_${status}`;
  const cached = getCached(key);
  if (cached) return cached;

  trackCall("fd");
  const params = { dateFrom, dateTo };
  if (status) params.status = status;

  const res = await axios.get(`${FD_BASE}/competitions/WC/matches`, {
    headers: fdHeaders(), params, timeout: 8000,
  });

  const matches = (res.data.matches || []).map(m => ({
    id:    `fd_${m.id}`,
    fdId:  m.id,
    date:  m.utcDate,
    round: m.stage || m.group || "Group Stage",
    status: m.status,
    home: { name:m.homeTeam.name, score:m.score?.fullTime?.home??null, id:m.homeTeam.id },
    away: { name:m.awayTeam.name, score:m.score?.fullTime?.away??null, id:m.awayTeam.id },
    goals: [],
    events: [],
    source: "football-data.org",
  }));

  setCache(key, matches);
  return matches;
}

async function fdGetStandings() {
  const key = "fd_standings";
  const cached = getCached(key);
  if (cached) return cached;
  trackCall("fd");
  const res = await axios.get(`${FD_BASE}/competitions/WC/standings`, { headers:fdHeaders(), timeout:8000 });
  const data = res.data.standings || [];
  setCache(key, data);
  return data;
}

async function fdGetH2H(fdMatchId) {
  const key = `fd_h2h_${fdMatchId}`;
  const cached = getCached(key);
  if (cached) return cached;
  trackCall("fd");
  const res = await axios.get(`${FD_BASE}/matches/${fdMatchId}/head2head`, { headers:fdHeaders(), params:{limit:5}, timeout:8000 });
  const h2h = (res.data.matches||[]).map(m=>({ date:m.utcDate.split("T")[0], home:m.homeTeam.name, away:m.awayTeam.name, homeScore:m.score?.fullTime?.home, awayScore:m.score?.fullTime?.away }));
  setCache(key, h2h);
  return h2h;
}

// ══════════════════════════════════════════════════════════════
// [3] api-football  — ENRICHMENT SOURCE (goals, stats, players)
// ══════════════════════════════════════════════════════════════

async function afGetFinished() {
  // Use UTC date — GitHub Actions is UTC
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now()-86400000).toISOString().split("T")[0];
  const key = `af_finished_${today}`;
  const cached = getCached(key);
  if (cached) return cached;

  trackCall("af");
  // Check both today AND yesterday to catch timezone edge cases
  const [todayRes, yRes] = await Promise.allSettled([
    axios.get(`${AF_BASE}/fixtures`, { headers:afHeaders(), params:{ league:1, season:2026, date:today, status:"FT" }, timeout:8000 }),
    axios.get(`${AF_BASE}/fixtures`, { headers:afHeaders(), params:{ league:1, season:2026, date:yesterday, status:"FT" }, timeout:8000 }),
  ]);

  const todayMatches = todayRes.status==="fulfilled" ? todayRes.value.data.response : [];
  const yMatches     = yRes.status==="fulfilled"     ? yRes.value.data.response     : [];

  // Deduplicate
  const seen = new Set();
  const all = [...todayMatches, ...yMatches].filter(m => {
    if (seen.has(m.fixture.id)) return false;
    seen.add(m.fixture.id); return true;
  });

  const matches = all.map(m => ({
    id:    m.fixture.id,
    afId:  m.fixture.id,
    date:  m.fixture.date,
    round: m.league.round,
    home:  { name:m.teams.home.name, id:m.teams.home.id, score:m.goals.home },
    away:  { name:m.teams.away.name, id:m.teams.away.id, score:m.goals.away },
    goals: (m.events||[]).filter(e=>e.type==="Goal").map(e=>({ team:e.team.name, player:e.player.name, minute:e.time.elapsed, type:e.detail })),
    events: m.events||[],
    source: "api-football",
  }));

  setCache(key, matches);
  return matches;
}

async function afGetUpcoming(fromH, toH) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const tomorrow = new Date(Date.now()+86400000).toISOString().split("T")[0];
  trackCall("af");

  const [todayRes, tomRes] = await Promise.allSettled([
    axios.get(`${AF_BASE}/fixtures`, { headers:afHeaders(), params:{ league:1, season:2026, date:today, status:"NS" }, timeout:8000 }),
    axios.get(`${AF_BASE}/fixtures`, { headers:afHeaders(), params:{ league:1, season:2026, date:tomorrow, status:"NS" }, timeout:8000 }),
  ]);

  const all = [
    ...(todayRes.status==="fulfilled" ? todayRes.value.data.response : []),
    ...(tomRes.status==="fulfilled" ? tomRes.value.data.response : []),
  ];

  return all
    .filter(m => { const k=new Date(m.fixture.date); return k>=new Date(now.getTime()+fromH*3600000)&&k<=new Date(now.getTime()+toH*3600000); })
    .map(m => ({ id:m.fixture.id, afId:m.fixture.id, date:m.fixture.date, round:m.league.round,
      home:{name:m.teams.home.name,id:m.teams.home.id}, away:{name:m.teams.away.name,id:m.teams.away.id} }));
}

// ══════════════════════════════════════════════════════════════
// UNIFIED PUBLIC API — what the bots actually call
// ══════════════════════════════════════════════════════════════

// Get finished matches — WC26 first → AF fallback → FD last resort
export async function getFinishedMatches() {
  // Try worldcup26.ir first (no key needed)
  try {
    const matches = await wcGetMatches("finished");
    if (matches.length > 0) {
      console.log(`  ✅ [worldcup26.ir] ${matches.length} finished match(es)`);
      // Enrich with AF goals/events if we have budget
      const counts = (() => { try{return JSON.parse(fs.readFileSync(COUNTS_FILE,"utf8"));}catch{return{af:0};} })();
      if ((counts.af||0) < 80) {
        for (const m of matches) {
          if (m.goals.length===0 && m.home.score>0 || m.away.score>0) {
            const afData = await afGetFinished().catch(()=>[]);
            const afMatch = afData.find(a => a.home.name===m.home.name && a.away.name===m.away.name);
            if (afMatch?.goals.length) { m.goals=afMatch.goals; m.events=afMatch.events; m.afId=afMatch.afId; }
          }
        }
      }
      return matches;
    }
  } catch(e) { console.log(`  ⚠️  worldcup26.ir failed: ${e.message}`); }

  // Fallback: api-football
  try {
    const matches = await afGetFinished();
    if (matches.length > 0) { console.log(`  ✅ [api-football] ${matches.length} finished match(es)`); return matches; }
  } catch(e) { console.log(`  ⚠️  api-football failed: ${e.message}`); }

  // Last resort: football-data.org
  try {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now()-86400000).toISOString().split("T")[0];
    const matches = await fdGetMatches(yesterday, today, "FINISHED");
    console.log(`  ✅ [football-data.org] ${matches.length} finished match(es)`);
    return matches;
  } catch(e) { console.log(`  ⚠️  football-data.org failed: ${e.message}`); }

  return [];
}

// Get upcoming — WC26 first → AF fallback → FD last resort
export async function getUpcomingMatches(fromH, toH) {
  const now = new Date();

  try {
    const all = await wcGetMatches("upcoming");
    const filtered = all.filter(m => {
      const k = new Date(m.date);
      return k >= new Date(now.getTime()+fromH*3600000) && k <= new Date(now.getTime()+toH*3600000);
    });
    if (filtered.length > 0 || all.length > 0) return filtered;
  } catch(e) { console.log(`  ⚠️  WC26 upcoming: ${e.message}`); }

  try { return await afGetUpcoming(fromH, toH); }
  catch(e) { console.log(`  ⚠️  AF upcoming: ${e.message}`); }

  try {
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now()+86400000).toISOString().split("T")[0];
    const all = await fdGetMatches(today, tomorrow, "SCHEDULED,TIMED");
    return all.filter(m => {
      const k=new Date(m.date);
      return k>=new Date(now.getTime()+fromH*3600000)&&k<=new Date(now.getTime()+toH*3600000);
    });
  } catch(e) { console.log(`  ⚠️  FD upcoming: ${e.message}`); }

  return [];
}

// Get standings
export async function getStandings() {
  try { return await wcGetStandings(); } catch(e) { console.log(`  ⚠️  WC26 standings: ${e.message}`); }
  try { return await fdGetStandings(); } catch(e) { console.log(`  ⚠️  FD standings: ${e.message}`); }
  return [];
}

// Get H2H
export async function getH2H(match) {
  if (match.fdId) { try { return await fdGetH2H(match.fdId); } catch{} }
  if (match.home?.id && match.away?.id) {
    try {
      trackCall("af");
      const res = await axios.get(`${AF_BASE}/fixtures/headtohead`, {
        headers:afHeaders(), params:{h2h:`${match.home.id}-${match.away.id}`,last:5}, timeout:8000,
      });
      return res.data.response.slice(0,5).map(m=>({ date:m.fixture.date.split("T")[0], home:m.teams.home.name, away:m.teams.away.name, homeScore:m.goals.home, awayScore:m.goals.away }));
    } catch{}
  }
  return [];
}

// Get today's results (for daily roundup — merges all sources)
export async function getTodaysResults() {
  const results=[], seen=new Set();
  const add = (m) => { const k=`${m.home.name}_${m.away.name}`; if(!seen.has(k)){seen.add(k);results.push(m);} };

  try { (await wcGetMatches("finished")).forEach(add); } catch{}
  try { (await afGetFinished()).forEach(add); } catch{}

  return results;
}

// Get top scorers (AF only)
export async function getTopScorers() {
  trackCall("af");
  const res = await axios.get(`${AF_BASE}/players/topscorers`, {
    headers:afHeaders(), params:{league:1,season:2026}, timeout:8000,
  });
  return res.data.response.slice(0,8).map(p=>({
    name:p.player.name, team:p.statistics[0]?.team?.name,
    goals:p.statistics[0]?.goals?.total||0, assists:p.statistics[0]?.goals?.assists||0,
    appearances:p.statistics[0]?.games?.appearences||0,
    rating:parseFloat(p.statistics[0]?.games?.rating||0).toFixed(1),
  }));
}

// Get player stats (AF only)
export async function getMatchPlayerStats(fixtureId) {
  if (!fixtureId || String(fixtureId).startsWith("wc_") || String(fixtureId).startsWith("fd_")) return [];
  trackCall("af");
  const res = await axios.get(`${AF_BASE}/fixtures/players`, {
    headers:afHeaders(), params:{fixture:fixtureId}, timeout:8000,
  });
  return (res.data.response||[]).flatMap(team =>
    team.players.map(p=>({
      name:p.player.name, team:team.team.name,
      rating:parseFloat(p.statistics[0]?.games?.rating||0),
      goals:p.statistics[0]?.goals?.total||0,
      assists:p.statistics[0]?.goals?.assists||0,
      minutes:p.statistics[0]?.games?.minutes||0,
      shots:p.statistics[0]?.shots?.total||0,
      tackles:p.statistics[0]?.tackles?.total||0,
    }))
  );
}

// Print API usage
export function printApiUsage() {
  try {
    const c=JSON.parse(fs.readFileSync(COUNTS_FILE,"utf8"));
    console.log(`\n📊 API calls today — worldcup26.ir: ${c.wc||0} | football-data.org: ${c.fd||0} | api-football: ${c.af||0}/100`);
  } catch{}
}
