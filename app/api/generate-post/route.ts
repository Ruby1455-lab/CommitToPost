import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini client using the environment variable
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Call Gemini directly with your original working model
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
    });

    if (!response) {
      return NextResponse.json({ error: "Failed to generate post." }, { status: 500 });
    }

    const postContent = response.text ?? "";
    return NextResponse.json({ post: postContent });

  } catch (error: any) {
    console.error("Error generating post:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate post. Please try again." }, 
      { status: 500 }
    );
  }
}