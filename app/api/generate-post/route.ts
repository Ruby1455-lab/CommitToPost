import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper function to pause execution for retries
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  try {
    const { commitLog, repoName, persona } = await request.json();

    if (!commitLog) {
      return NextResponse.json({ error: "Commit log is required." }, { status: 400 });
    }

    const prompt = `
      You are an expert developer advocate and social media manager. 
      Generate a professional and engaging social media post based on the following GitHub commit log for repository "${repoName || "project"}":
      
      Commit Message / Diff: "${commitLog}"
      Persona / Tone: ${persona || "influencer"}
      
      Return your response as a JSON object with the following keys:
      - "post": The generated social media post text.
      - "hustleScore": A number between 50 and 100 representing the intensity of the work.
      - "badge": A short 2-3 word badge title (e.g., "Code Crusher", "Late Night Grinder").
      - "impactSummary": A short 1-sentence summary of the technical impact.
    `;

    // Try standard stable model names first, then preview flashes
    const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-3.8-flash"];
    let text = "";

    for (const modelName of modelsToTry) {
      // Retry up to 2 times per model if hit with 503 capacity issues
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
          });

          if (response.text) {
            text = response.text;
            break;
          }
        } catch (err: any) {
          console.warn(`[${modelName}] Attempt ${attempt + 1} failed: ${err.message}`);
          if (attempt < 1) await sleep(1000); // Wait 1 second before retrying
        }
      }
      if (text) break; // Exit main loop if successfully generated
    }

    if (!text) {
      return NextResponse.json(
        { error: "Google AI servers are temporarily busy. Please wait 10 seconds and click Generate again!" },
        { status: 503 }
      );
    }

    let data;
    try {
      const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
      data = JSON.parse(cleanJson);
    } catch {
      data = {
        post: text,
        hustleScore: 85,
        badge: "Code Crusher",
        impactSummary: "Shipped key features and performance optimizations.",
      };
    }

    return NextResponse.json(
      {
        post: data.post,
        hustleScore: data.hustleScore || 85,
        badge: data.badge || "Dev Grind",
        impactSummary: data.impactSummary || "Solid engineering output.",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Gemini generation error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error during generation." },
      { status: 500 }
    );
  }
}