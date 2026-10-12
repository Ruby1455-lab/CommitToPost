import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const PERSONA_PROMPTS: Record<string, string> = {
  junior: `You are a caffeinated Junior Developer at 3 AM. You are slightly panicked, hyper-enthusiastic, rely heavily on energy drinks, and express pure relief when code finally works. Use playful emojis (☕, 😭, 🚀) and relatable humor.`,
  senior: `You are a battle-tested Senior Software Architect. You are dry, pragmatic, slightly cynical about tech hypes, and focus on clean code, test coverage, and avoiding technical debt. Keep it concise, professional, and subtle.`,
  influencer: `You are a viral Tech Influencer on X and LinkedIn. You write attention-grabbing hooks, line-by-line scannable formatting, heavy emojis, and hype up engineering progress to drive maximum audience engagement.`,
  meme: `You are a Tech Meme Creator. Turn these git commits into relatable developer humor, self-deprecating jokes, or funny developer observations. Focus on the pain of debugging, null pointers, or unexpected edge cases.`
};

// Helper function to retry if the model is temporarily overloaded (503)
async function generateWithRetry(prompt: string, retries = 3, delay = 1500) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
      });
      return response;
    } catch (error: any) {
      // If it's a 503 error and we have retries left, wait and try again
      if ((error?.status === 503 || error?.message?.includes("503") || error?.message?.includes("overloaded")) && i < retries - 1) {
        console.warn(`Model busy (503). Retrying in ${delay}ms... (Attempt ${i + 1})`);
        await new Promise((res) => setTimeout(res, delay * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { commits, repoName, persona = "influencer" } = body;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is missing from environment variables." }, { status: 500 });
    }

    if (!commits || commits.length === 0) {
      return NextResponse.json({ error: "No commits provided" }, { status: 400 });
    }

    const commitMessages = commits
      .map((c: any) => `- ${c.commit?.message || "No message"}`)
      .join("\n");

    const selectedPersonaPrompt = PERSONA_PROMPTS[persona] || PERSONA_PROMPTS.influencer;

    const prompt = `${selectedPersonaPrompt}

Look at these recent git commits from the repository "${repoName}":
${commitMessages}

Write an engaging social media post (under 280 characters) about what was built/fixed, staying strictly in character!`;

 // Call Gemini with automatic retry built-in
    const response = await generateWithRetry(prompt);
    if (!response) {
      return NextResponse.json({ error: "Failed to generate post." }, { status: 500 });
    }
    const postContent = response.text ?? "";
    return NextResponse.json({ post: postContent });
  } catch (error: any) {
    console.error("Error generating post:", error);
    return NextResponse.json({ error: error.message || "Failed to generate post. Please try again." }, { status: 500 });
  }