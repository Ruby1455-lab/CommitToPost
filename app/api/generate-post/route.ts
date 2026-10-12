import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Call Gemini with automatic retry built-in
    const response = await generateWithRetry(prompt);
    
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