// scripts/generateScript.js — Gemini powered
import { generate } from "./ai.js";
import "dotenv/config";

export async function generateScript(match) {
  const goalsList = (match.goals || [])
    .map(g => `${g.player} (${g.minute}')${g.type !== "Normal Goal" ? ` [${g.type}]` : ""} — ${g.team}`)
    .join("\n") || "No goals scored";

  const winner = match.home.score > match.away.score ? match.home.name
    : match.away.score > match.home.score ? match.away.name : null;

  const script = await generate(`You are a FIFA World Cup video narrator. Write a punchy 60-second YouTube Shorts script.

MATCH: ${match.home.name} ${match.home.score} - ${match.away.score} ${match.away.name}
ROUND: ${match.round}
RESULT: ${winner ? winner + " WIN" : "DRAW"}
GOALS:\n${goalsList}

FORMAT:
[HOOK] One dramatic opening line.
[RECAP] 3-4 sentences on how the match unfolded.
[GOALS] One sentence per goal, vivid and dramatic.
[VERDICT] What this result means for the tournament.
[OUTRO] Question to drive comments.

Under 200 words. High energy. Gen Z tone. No emojis in script.`);

  const meta = await generate(`YouTube metadata for: ${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name} FIFA World Cup 2026.
TITLE: (max 70 chars, include score, clickable)
DESCRIPTION: (3 sentences SEO-rich)
HASHTAGS: (10 tags)
Format exactly — TITLE: ... DESCRIPTION: ... HASHTAGS: ...`, 400);

  return {
    script,
    title: meta.match(/TITLE:\s*(.+)/)?.[1]?.trim() || `⚽ ${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name} | WC2026`,
    description: meta.match(/DESCRIPTION:\s*([\s\S]+?)(?=HASHTAGS:|$)/)?.[1]?.trim() || script.slice(0, 300),
    hashtags: meta.match(/HASHTAGS:\s*(.+)/)?.[1]?.trim() || "#FIFAWorldCup2026",
    videoType: "recap",
  };
}
