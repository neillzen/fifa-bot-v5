// scripts/ai.js
// Central AI module — powered by Google Gemini 2.5 Flash (FREE, no credit card)
// Drop-in replacement for Anthropic Claude
// Get your free API key: https://aistudio.google.com → "Get API key"

import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Generate text from a prompt using Gemini 2.5 Flash
 * Same interface as the old Claude calls — just swap in this function
 */
export async function generate(prompt, maxTokens = 1024) {
  const response = await genai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { maxOutputTokens: maxTokens, temperature: 0.9 },
  });
  return response.text;
}

/**
 * Generate structured JSON from a prompt
 * Automatically strips markdown fences and parses
 */
export async function generateJSON(prompt, fallback = {}) {
  const raw = await generate(prompt + "\n\nRespond with pure JSON only. No markdown, no backticks, no explanation.");
  try {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    console.error("  ⚠️  JSON parse failed, using fallback");
    return fallback;
  }
}

// Quick test
if (process.argv[1].includes("ai.js")) {
  const result = await generate("Say hello in one sentence.");
  console.log("✅ Gemini working:", result);
}
