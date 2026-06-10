// scripts/twitterThreads.js
// Posts match stats as Twitter/X threads — drives traffic back to YouTube

import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import "dotenv/config";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateMatchThread(match, youtubeUrl) {
  const goalsList = (match.goals || []).map(g => `⚽ ${g.player} ${g.minute}' (${g.team})`).join("\n");

  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 800,
    messages: [{ role: "user", content: `Write a Twitter/X thread (5 tweets) about this World Cup match.

MATCH: ${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}
ROUND: ${match.round}
GOALS: ${goalsList || "None"}
YOUTUBE VIDEO: ${youtubeUrl}

Write exactly 5 tweets. Each tweet max 270 chars. Format:

TWEET 1: (Hook tweet — dramatic result announcement with score)
TWEET 2: (Key stats or match flow — what happened?)
TWEET 3: (Best moment or talking point from the game)
TWEET 4: (Reaction tweet — hot take or question to followers)
TWEET 5: (CTA — "Full breakdown in our video 👇" + ${youtubeUrl} + relevant hashtags)

Each tweet on its own line starting with "TWEET N:"` }],
  });

  const text = msg.content[0].text;
  const tweets = [];
  for (let i = 1; i <= 5; i++) {
    const match2 = text.match(new RegExp(`TWEET ${i}:\\s*([\\s\\S]+?)(?=TWEET ${i+1}:|$)`));
    if (match2) tweets.push(match2[1].trim());
  }

  return tweets.length ? tweets : [
    `⚽ ${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name} | FIFA World Cup 2026`,
    `Full match breakdown: ${youtubeUrl}`,
  ];
}

export async function postThread(tweets) {
  if (process.env.DRY_RUN === "true") {
    console.log("  🔶 DRY RUN — Twitter thread:");
    tweets.forEach((t,i) => console.log(`    [${i+1}] ${t.slice(0,80)}...`));
    return { posted: true, dry: true };
  }

  if (!process.env.TWITTER_BEARER_TOKEN) {
    console.log("  ⚠️ Twitter not configured — skipping");
    return null;
  }

  const headers = {
    Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
    "Content-Type": "application/json",
  };

  let lastTweetId = null;
  const postedIds = [];

  for (const tweet of tweets) {
    const body = lastTweetId
      ? { text: tweet, reply: { in_reply_to_tweet_id: lastTweetId } }
      : { text: tweet };

    const res = await axios.post("https://api.twitter.com/2/tweets", body, { headers });
    lastTweetId = res.data.data.id;
    postedIds.push(lastTweetId);
    await new Promise(r => setTimeout(r, 1000)); // Rate limit safety
  }

  console.log(`  ✅ Twitter thread posted (${postedIds.length} tweets)`);
  return { ids: postedIds, url: `https://twitter.com/i/web/status/${postedIds[0]}` };
}

// SETUP: Add to .env:
// TWITTER_BEARER_TOKEN=your_bearer_token
// TWITTER_API_KEY=your_api_key
// TWITTER_API_SECRET=your_api_secret
// TWITTER_ACCESS_TOKEN=your_access_token
// TWITTER_ACCESS_SECRET=your_access_secret
// Get credentials at: https://developer.twitter.com
// Required: Free tier allows 1,500 tweets/month (more than enough for 64 matches)
