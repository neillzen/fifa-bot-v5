// scripts/publisher.js
// Central publishing module — powered by Zernio (FREE tier, no credit card)
// Posts to YouTube + TikTok + Twitter in ONE API call
// Get your free key: https://zernio.com → sign up → connect accounts → copy API key

import axios from "axios";
import fs from "fs";
import FormData from "form-data";
import "dotenv/config";

const ZERNIO_API = "https://zernio.com/api/v1";

/**
 * Upload a video file to Zernio's CDN first, get back a hosted URL
 * Zernio needs a URL, not a raw file — this handles the upload
 */
async function uploadMediaToZernio(filePath) {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));

  const res = await axios.post(`${ZERNIO_API}/media/upload`, form, {
    headers: {
      Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`,
      ...form.getHeaders(),
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  return res.data.url; // Hosted CDN URL
}

/**
 * Post a video to all configured platforms via Zernio
 * Platforms auto-detected from which account IDs are set in .env
 */
export async function publishVideo(videoPath, thumbPath, meta) {
  if (process.env.DRY_RUN === "true") {
    console.log(`    🔶 DRY RUN: "${meta.title.slice(0, 60)}..."`);
    return { id: "dry_run", url: "https://youtube.com/watch?v=dry_run", platforms: [] };
  }

  if (!process.env.ZERNIO_API_KEY) {
    throw new Error("ZERNIO_API_KEY not set. Get yours free at zernio.com");
  }

  console.log("    📤 Uploading media to Zernio CDN...");
  const videoUrl = await uploadMediaToZernio(videoPath);
  const thumbUrl = thumbPath ? await uploadMediaToZernio(thumbPath) : null;

  // Build platform targets from env — only include platforms that are configured
  const platforms = [];

  if (process.env.ZERNIO_YOUTUBE_ACCOUNT_ID) {
    platforms.push({
      platform: "youtube",
      accountId: process.env.ZERNIO_YOUTUBE_ACCOUNT_ID,
      platformSpecificData: {
        youtubeSettings: {
          title: meta.title,
          description: `${meta.description}\n\n${meta.hashtags}`,
          tags: meta.hashtags.replace(/#/g, "").split(" ").filter(Boolean),
          categoryId: "17",           // Sports
          privacyStatus: "public",
          madeForKids: false,
          ...(thumbUrl ? { thumbnailUrl: thumbUrl } : {}),
        },
      },
    });
  }

  if (process.env.ZERNIO_TIKTOK_ACCOUNT_ID) {
    platforms.push({
      platform: "tiktok",
      accountId: process.env.ZERNIO_TIKTOK_ACCOUNT_ID,
      platformSpecificData: {
        tiktokSettings: {
          privacy_level: "PUBLIC_TO_EVERYONE",
          allow_comment: true,
          allow_duet: true,
          allow_stitch: true,
        },
      },
    });
  }

  if (process.env.ZERNIO_TWITTER_ACCOUNT_ID) {
    platforms.push({
      platform: "twitter",
      accountId: process.env.ZERNIO_TWITTER_ACCOUNT_ID,
    });
  }

  if (platforms.length === 0) {
    throw new Error("No platform account IDs configured. Set ZERNIO_YOUTUBE_ACCOUNT_ID etc in .env");
  }

  console.log(`    🚀 Publishing to: ${platforms.map(p => p.platform).join(", ")}`);

  const res = await axios.post(
    `${ZERNIO_API}/posts`,
    {
      content: `${meta.title}\n\n${meta.hashtags}`,
      mediaItems: [{ type: "video", url: videoUrl }],
      platforms,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  const post = res.data.post;
  const youtubeResult = post.platformResults?.find(p => p.platform === "youtube");
  const youtubeUrl = youtubeResult?.url || `https://youtube.com/@${process.env.CHANNEL_NAME || "yourchannel"}`;
  const youtubeId  = youtubeResult?.platformPostId || post._id;

  console.log(`    ✅ Published! ${youtubeUrl}`);
  return {
    id: youtubeId,
    url: youtubeUrl,
    postId: post._id,
    platforms: platforms.map(p => p.platform),
  };
}

/**
 * Post a text-only community post (for carousels / polls)
 * Uses YouTube platform via Zernio
 */
export async function publishCommunityPost(text, imageUrls = []) {
  if (process.env.DRY_RUN === "true") {
    console.log(`    🔶 DRY RUN community post: "${text.slice(0, 60)}..."`);
    return { posted: true };
  }

  if (!process.env.ZERNIO_YOUTUBE_ACCOUNT_ID) return null;

  const mediaItems = imageUrls.map(url => ({ type: "image", url }));

  const res = await axios.post(
    `${ZERNIO_API}/posts`,
    {
      content: text,
      ...(mediaItems.length ? { mediaItems } : {}),
      platforms: [{
        platform: "youtube",
        accountId: process.env.ZERNIO_YOUTUBE_ACCOUNT_ID,
        platformSpecificData: { youtubeSettings: { postType: "community" } },
      }],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return res.data.post;
}

/**
 * Post a Twitter thread — each tweet as a reply to the previous
 */
export async function publishThread(tweets) {
  if (process.env.DRY_RUN === "true") {
    console.log(`    🔶 DRY RUN thread (${tweets.length} tweets)`);
    return { posted: true };
  }

  if (!process.env.ZERNIO_TWITTER_ACCOUNT_ID) return null;

  let lastPostId = null;

  for (const tweet of tweets) {
    const body = {
      content: tweet,
      platforms: [{
        platform: "twitter",
        accountId: process.env.ZERNIO_TWITTER_ACCOUNT_ID,
        ...(lastPostId ? { platformSpecificData: { replyToId: lastPostId } } : {}),
      }],
    };

    const res = await axios.post(`${ZERNIO_API}/posts`, body, {
      headers: {
        Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    lastPostId = res.data.post?.platformResults?.[0]?.platformPostId;
    await new Promise(r => setTimeout(r, 1000)); // Rate limit safety
  }

  console.log(`    ✅ Thread posted (${tweets.length} tweets)`);
  return { posted: true };
}
