import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini client using your environment variable
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  try {
    const { commitLog, platform, tone } = await request.json();

    if (!commitLog) {
      return NextResponse.json({ error: "Commit log is required." }, { status: 400 });
    }

    // Construct a prompt for generating social media posts based on commit data
    const prompt = `
      You are an expert developer advocate and social media manager. 
      Generate a professional and engaging ${platform || "LinkedIn/Twitter"} post based on the following GitHub commit log:
      
      Commit Message / Diff: "${commitLog}"
      Tone: ${tone || "professional yet enthusiastic"}
      
      Make it catchy, include appropriate hashtags, and keep it formatted cleanly.
    `;

    // Calling the Gemini model configured for text generation
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
    });

    const generatedText = response.text;

    if (!generatedText) {
      return NextResponse.json({ error: "Failed to generate text from Gemini." }, { status: 500 });
    }

    return NextResponse.json({ post: generatedText }, { status: 200 });
  } catch (error: any) {
    console.error("Gemini generation error:", error);
    return NextResponse.json({ error: error.message || "Internal server error during generation." }, { status: 500 });
  }
}