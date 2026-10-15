import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

    // Try primary model first, fallback to backup models if 503 high demand occurs
    const modelsToTry = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-1.5-flash"];
    let text = "";
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
        });

        if (response.text) {
          text = response.text;
          break; // Success! Break out of loop
        }
      } catch (err: any) {
        console.warn(`Model ${modelName} failed or busy. Trying fallback...`, err.message);
        lastError = err;
      }
    }

    if (!text) {
      return NextResponse.json({ 
        error: "Google AI servers are currently overloaded. Please wait a few seconds and try again." 
      }, { status: 503 });
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

    return NextResponse.json({
      post: data.post,
      hustleScore: data.hustleScore || 85,
      badge: data.badge || "Dev Grind",
      impactSummary: data.impactSummary || "Solid engineering output.",
    }, { status: 200 });

  } catch (error: any) {
    console.error("Gemini generation error:", error);
    return NextResponse.json({ error: error.message || "Internal server error during generation." }, { status: 500 });
  }
}