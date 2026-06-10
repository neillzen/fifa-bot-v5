// scripts/masterPipeline.js  v5 — FINAL (Gemini + Zernio, zero credit card)
// ════════════════════════════════════════════════════════════════════
// AI:       Google Gemini 2.5 Flash  (free @ aistudio.google.com)
// Posting:  Zernio                   (free tier @ zernio.com)
// ════════════════════════════════════════════════════════════════════
//
// CONTENT SCHEDULE PER MATCH (16 types):
// T-24h → Team History, Underdog Hype, Prediction Carousel
// T-2h  → Game Prediction
// T-1h  → Player Comparison
// T+0   → Recap, MOTM, VAR, Underdog Post, Standings, Prediction Callback
// T+24h → Comment Reaction
// DAILY → Daily Roundup (9PM), Golden Boot (10:30PM)

import "dotenv/config";
import axios from "axios";

import { getFinishedMatches, markAsPosted }     from "./checkMatches.js";
import { generateScript }                        from "./generateScript.js";
import { generateThumbnail }                     from "./generateThumbnail.js";
import { renderVideo }                           from "./renderVideo.js";
import { publishVideo, publishCommunityPost, publishThread } from "./publisher.js";
import { generate }                              from "./ai.js";

import { fetchPreMatchData, generateAnalysisScript, renderAnalysisThumbnail } from "./preMatchAnalysis.js";
import { generateHistoryScript, renderHistoryThumbnail }   from "./teamHistoryAnalysis.js";
import { generatePredictionScript, renderPredictionThumbnail } from "./gamePrediction.js";
import { fetchPlayerStats, generateComparisonScript, renderComparisonThumbnail, getComparisonType } from "./playerComparison.js";
import { fetchTopComment, generateReactionScript, renderReactionThumbnail } from "./bestCommentRepost.js";
import { generateCarouselContent, renderSlide1, renderSlide2, renderSlide3 } from "./predictionCarousel.js";
import { detectUnderdog, didUnderdogWin, generateUnderdogPreScript, generateUnderdogPostScript, renderUnderdogPreThumbnail, renderUnderdogPostThumbnail } from "./underdogNarrative.js";
import { fetchMatchPlayerStats, generateMotmScript, renderMotmThumbnail } from "./manOfTheMatch.js";
import { detectControversy, generateVarScript, renderVarThumbnail } from "./varControversy.js";
import { fetchGroupStandings, generateStandingsScript, renderStandingsThumbnail } from "./standingsUpdate.js";
import { getPredictionResult, generateCallbackScript, renderCallbackThumbnail } from "./predictionCallback.js";
import { fetchTopScorers, generateGoldenBootScript, renderGoldenBootThumbnail } from "./goldenBootTracker.js";
import { fetchTodaysMatches, generateRoundupScript, renderRoundupThumbnail } from "./dailyRoundup.js";
import { generateMatchThread } from "./twitterThreads.js";

import fs from "fs";

const isDryRun   = process.argv.includes("--dry-run") || process.env.DRY_RUN === "true";
const isRoundup  = process.argv.includes("--roundup");
const isGoldBoot = process.argv.includes("--golden-boot");
const LOG_FILE   = "./data/upload_log.json";

function loadLog()   { try { return JSON.parse(fs.readFileSync(LOG_FILE,"utf8")); } catch { return []; } }
function saveLog(l)  { fs.mkdirSync("./data",{recursive:true}); fs.writeFileSync(LOG_FILE,JSON.stringify(l,null,2)); }
function wasPosted(id, type) { return loadLog().some(e=>e.matchId===id&&e.videoType===type); }
function logEntry(e) { const l=loadLog(); l.push({...e,date:new Date().toISOString()}); saveLog(l); }

async function getUpcoming(fromH, toH) {
  const now=new Date(), today=now.toISOString().split("T")[0];
  const res=await axios.get("https://v3.football.api-sports.io/fixtures",{
    headers:{"x-rapidapi-key":process.env.FOOTBALL_API_KEY,"x-rapidapi-host":"v3.football.api-sports.io"},
    params:{league:process.env.FOOTBALL_LEAGUE_ID||1,season:2026,date:today,status:"NS"},
  });
  return res.data.response
    .filter(m=>{const k=new Date(m.fixture.date),f=new Date(now.getTime()+fromH*3600000),t=new Date(now.getTime()+toH*3600000);return k>=f&&k<=t;})
    .map(m=>({id:m.fixture.id,date:m.fixture.date,round:m.league.round,home:{name:m.teams.home.name,id:m.teams.home.id},away:{name:m.teams.away.name,id:m.teams.away.id}}));
}

// ── Core upload helper ────────────────────────────────────────
async function upload(match, meta, thumbPath) {
  const videoPath = await renderVideo(match);
  return publishVideo(videoPath, thumbPath, meta);
}

// ════════════ VIDEO RUNNERS ══════════════════════════════════

async function run_TeamHistory(m) {
  if(wasPosted(m.id,"team-history"))return;
  console.log(`\n  📜 Team History: ${m.home.name} vs ${m.away.name}`);
  const meta=await generateHistoryScript(m),thumb=renderHistoryThumbnail(m);
  const up=await upload(m,meta,thumb);
  logEntry({matchId:m.id,videoType:"team-history",match:`${m.home.name} vs ${m.away.name}`,...up,title:meta.title});
  console.log(`    ✅ ${up.url}`);
}

async function run_UnderdogPre(m) {
  if(wasPosted(m.id,"underdog-pre"))return;
  const info=detectUnderdog(m);if(!info)return;
  console.log(`\n  🔥 Underdog Hype: ${info.underdog.name} (gap:${info.rankDiff})`);
  const meta=await generateUnderdogPreScript(m,info),thumb=renderUnderdogPreThumbnail(m,info);
  const up=await upload(m,meta,thumb);
  logEntry({matchId:m.id,videoType:"underdog-pre",match:`${m.home.name} vs ${m.away.name}`,...up,title:meta.title});
  console.log(`    ✅ ${up.url}`);
}

async function run_Carousel(m) {
  if(wasPosted(m.id,"carousel"))return;
  console.log(`\n  🎠 Prediction Carousel: ${m.home.name} vs ${m.away.name}`);
  const content=await generateCarouselContent(m);
  const s1=renderSlide1(m,content),s2=renderSlide2(m,content),s3=renderSlide3(m,content);
  // Upload slides to Zernio CDN then post as community post
  await publishCommunityPost(content.community_post_text,[s1,s2,s3]).catch(e=>console.log("    ⚠️ Community post:",e.message));
  logEntry({matchId:m.id,videoType:"carousel",match:`${m.home.name} vs ${m.away.name}`,url:"community-post",title:`Prediction: ${m.home.name} vs ${m.away.name}`});
  console.log(`    ✅ Carousel posted`);
}

async function run_Prediction(m) {
  if(wasPosted(m.id,"prediction"))return;
  console.log(`\n  🔮 Prediction: ${m.home.name} vs ${m.away.name}`);
  const data=await fetchPreMatchData(m.home.id,m.away.id);
  const meta=await generatePredictionScript(m,data),thumb=renderPredictionThumbnail(m,meta.predictedScore);
  const up=await upload(m,meta,thumb);
  logEntry({matchId:m.id,videoType:"prediction",predictedScore:meta.predictedScore,match:`${m.home.name} vs ${m.away.name}`,...up,title:meta.title});
  console.log(`    ✅ ${up.url}`);
}

async function run_PlayerComparison(m,idx) {
  if(wasPosted(m.id,"player-comparison"))return;
  const compType=getComparisonType(idx);
  console.log(`\n  ⚡ Player Comparison [${compType}]: ${m.home.name} vs ${m.away.name}`);
  const[hp,ap]=await Promise.all([fetchPlayerStats(m.home.id,compType),fetchPlayerStats(m.away.id,compType)]);
  const meta=await generateComparisonScript(m,hp[0],ap[0],compType),thumb=renderComparisonThumbnail(m,hp[0],ap[0],compType);
  const up=await upload(m,meta,thumb);
  logEntry({matchId:m.id,videoType:"player-comparison",compType,match:`${m.home.name} vs ${m.away.name}`,...up,title:meta.title});
  console.log(`    ✅ ${up.url}`);
}

async function run_Recap(m) {
  if(wasPosted(m.id,"recap"))return;
  console.log(`\n  ⚽ Recap: ${m.home.name} ${m.home.score}-${m.away.score} ${m.away.name}`);
  const meta=await generateScript(m),thumb=generateThumbnail(m);
  const up=await upload(m,meta,thumb);
  markAsPosted(m.id);
  logEntry({matchId:m.id,videoType:"recap",match:`${m.home.name} vs ${m.away.name}`,...up,title:meta.title});
  // Twitter thread via Zernio
  const tweets=await generateMatchThread(m,up.url);
  await publishThread(tweets).catch(e=>console.log(`    ⚠️ Thread: ${e.message}`));
  console.log(`    ✅ ${up.url}`);
  return up.id;
}

async function run_MOTM(m) {
  if(wasPosted(m.id,"man-of-the-match"))return;
  console.log(`\n  🌟 Man of the Match`);
  const player=await fetchMatchPlayerStats(m.id);
  if(!player){console.log("    ⚠️ No player stats");return;}
  const meta=await generateMotmScript(m,player),thumb=renderMotmThumbnail(m,player);
  const up=await upload(m,meta,thumb);
  logEntry({matchId:m.id,videoType:"man-of-the-match",player:player.name,match:`${m.home.name} vs ${m.away.name}`,...up,title:meta.title});
  console.log(`    ✅ ${up.url}`);
}

async function run_VAR(m) {
  if(wasPosted(m.id,"var-controversy"))return;
  const controversy=detectControversy(m);if(!controversy)return;
  console.log(`\n  🚨 VAR Controversy`);
  const meta=await generateVarScript(m,controversy),thumb=renderVarThumbnail(m,controversy);
  const up=await upload(m,meta,thumb);
  logEntry({matchId:m.id,videoType:"var-controversy",match:`${m.home.name} vs ${m.away.name}`,...up,title:meta.title});
  console.log(`    ✅ ${up.url}`);
}

async function run_UnderdogPost(m) {
  if(wasPosted(m.id,"underdog-post"))return;
  const info=detectUnderdog(m);
  if(!info||!didUnderdogWin(m,info))return;
  console.log(`\n  🚨 UPSET: ${info.underdog.name} beat ${info.favourite.name}!`);
  const meta=await generateUnderdogPostScript(m,info),thumb=renderUnderdogPostThumbnail(m,info);
  const up=await upload(m,meta,thumb);
  logEntry({matchId:m.id,videoType:"underdog-post",match:`${m.home.name} vs ${m.away.name}`,...up,title:meta.title});
  console.log(`    ✅ ${up.url}`);
}

async function run_Standings(m) {
  if(wasPosted(m.id,"standings-update"))return;
  if(!m.round?.toLowerCase().includes("group"))return;
  console.log(`\n  📊 Standings Update`);
  const standings=await fetchGroupStandings();
  const meta=await generateStandingsScript(m,standings),thumb=renderStandingsThumbnail(m,standings.find(g=>g.some(t=>t.team.name===m.home.name)));
  const up=await upload(m,meta,thumb);
  logEntry({matchId:m.id,videoType:"standings-update",match:`${m.home.name} vs ${m.away.name}`,...up,title:meta.title});
  console.log(`    ✅ ${up.url}`);
}

async function run_PredictionCallback(m) {
  if(wasPosted(m.id,"prediction-callback"))return;
  const pe=loadLog().find(e=>e.matchId===m.id&&e.videoType==="prediction");
  if(!pe?.predictedScore)return;
  console.log(`\n  🎯 Prediction Callback`);
  const pr=getPredictionResult(m,pe.predictedScore);
  const meta=await generateCallbackScript(m,pr),thumb=renderCallbackThumbnail(m,pr);
  const up=await upload(m,meta,thumb);
  logEntry({matchId:m.id,videoType:"prediction-callback",correct:pr.correctResult,...up,title:meta.title});
  console.log(`    ✅ ${up.url} [${pr.type}]`);
}

async function run_CommentReaction(matchId,matchLabel) {
  if(wasPosted(matchId,"comment-reaction"))return;
  const re=loadLog().find(e=>e.matchId===matchId&&e.videoType==="recap");
  if(!re?.id||re.id==="dry_run")return;
  const[hN,aN]=(matchLabel||"").split(" vs ");
  const m={id:matchId,home:{name:hN||"Home",score:0},away:{name:aN||"Away",score:0},round:"WC2026"};
  console.log(`\n  💬 Comment Reaction: ${matchLabel}`);
  const topComment=await fetchTopComment(re.id);
  if(!topComment){console.log("    ⚠️ No comments yet");return;}
  const meta=await generateReactionScript(m,topComment),thumb=renderReactionThumbnail(m,topComment);
  const up=await upload(m,meta,thumb);
  logEntry({matchId,videoType:"comment-reaction",match:matchLabel,...up,title:meta.title});
  console.log(`    ✅ ${up.url}`);
}

async function run_DailyRoundup() {
  const today=new Date().toISOString().split("T")[0];
  if(wasPosted(`roundup_${today}`,"daily-roundup"))return;
  console.log(`\n  📋 Daily Roundup: ${today}`);
  const matches=await fetchTodaysMatches();
  if(!matches.length){console.log("    ⚠️ No completed matches");return;}
  const meta=await generateRoundupScript(matches,today);
  if(!meta)return;
  const thumb=renderRoundupThumbnail(matches,today);
  const fakeMatch={id:`roundup_${today}`,home:{name:"WC",score:0},away:{name:"2026",score:0},round:"Roundup"};
  const up=await upload(fakeMatch,meta,thumb);
  logEntry({matchId:`roundup_${today}`,videoType:"daily-roundup",date:today,...up,title:meta.title});
  console.log(`    ✅ ${up.url}`);
}

async function run_GoldenBoot() {
  const today=new Date().toISOString().split("T")[0];
  if(wasPosted(`goldenboot_${today}`,"golden-boot"))return;
  console.log(`\n  🥾 Golden Boot Update`);
  const scorers=await fetchTopScorers();
  const matchDay=loadLog().filter(e=>e.videoType==="recap").length;
  const meta=await generateGoldenBootScript(scorers,matchDay),thumb=renderGoldenBootThumbnail(scorers);
  const fakeMatch={id:`goldenboot_${today}`,home:{name:"Top",score:0},away:{name:"Scorers",score:0},round:"Golden Boot"};
  const up=await upload(fakeMatch,meta,thumb);
  logEntry({matchId:`goldenboot_${today}`,videoType:"golden-boot",...up,title:meta.title});
  console.log(`    ✅ ${up.url}`);
}

// ════════════════════════ MAIN ════════════════════════════════
async function main() {
  console.log("\n🏆 FIFA World Cup 2026 — Auto Bot v5 FINAL");
  console.log(`📅 ${new Date().toLocaleString()}`);
  console.log("🤖 AI: Google Gemini 2.5 Flash  |  📤 Publisher: Zernio");
  if(isDryRun)console.log("🔶 DRY RUN");

  const log=loadLog();
  let matchIndex=log.filter(e=>e.videoType==="recap").length;

  if(isRoundup) { await run_DailyRoundup().catch(e=>console.error("Roundup:",e.message)); return; }
  if(isGoldBoot){ await run_GoldenBoot().catch(e=>console.error("GoldenBoot:",e.message)); return; }

  // T-24h
  console.log("\n📡 T-24h window...");
  try {
    for(const m of await getUpcoming(20,26)){
      await run_TeamHistory(m) .catch(e=>console.error("History:",e.message));
      await run_UnderdogPre(m) .catch(e=>console.error("Underdog pre:",e.message));
      await run_Carousel(m)    .catch(e=>console.error("Carousel:",e.message));
    }
  } catch(e){console.error("T-24h:",e.message);}

  // T-2h
  console.log("\n📡 T-2h window...");
  try {
    for(const m of await getUpcoming(1.5,2.5))
      await run_Prediction(m).catch(e=>console.error("Prediction:",e.message));
  } catch(e){console.error("T-2h:",e.message);}

  // T-1h
  console.log("\n📡 T-1h window...");
  try {
    for(const m of await getUpcoming(0.5,1.5))
      await run_PlayerComparison(m,matchIndex++).catch(e=>console.error("Comparison:",e.message));
  } catch(e){console.error("T-1h:",e.message);}

  // Post-match
  console.log("\n📡 Post-match...");
  let finished=[];
  try{finished=await getFinishedMatches();}catch(e){console.error("Fetch:",e.message);}
  for(const m of finished){
    await run_Recap(m)             .catch(e=>console.error("Recap:",e.message));
    await run_MOTM(m)              .catch(e=>console.error("MOTM:",e.message));
    await run_VAR(m)               .catch(e=>console.error("VAR:",e.message));
    await run_UnderdogPost(m)      .catch(e=>console.error("Underdog post:",e.message));
    await run_Standings(m)         .catch(e=>console.error("Standings:",e.message));
    await run_PredictionCallback(m).catch(e=>console.error("Callback:",e.message));
  }

  // T+24h
  console.log("\n📡 Comment reactions...");
  for(const e of loadLog().filter(e=>{if(e.videoType!=="recap")return false;const h=(Date.now()-new Date(e.date))/3600000;return h>=20&&h<=36;}))
    await run_CommentReaction(e.matchId,e.match).catch(e=>console.error("Reaction:",e.message));

  // Summary
  const todayLog=loadLog().filter(e=>new Date(e.date).toDateString()===new Date().toDateString());
  const byType={};todayLog.forEach(e=>{byType[e.videoType]=(byType[e.videoType]||0)+1;});
  console.log(`\n${"═".repeat(55)}`);
  console.log(`📹 Content published today: ${todayLog.length} pieces`);
  Object.entries(byType).sort((a,b)=>b[1]-a[1]).forEach(([t,c])=>console.log(`   [${t}] ×${c}`));
  console.log(`${"═".repeat(55)}`);
}

main().catch(err=>{console.error("💥 Fatal:",err);process.exit(1);});
