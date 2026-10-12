import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Lazy initialization function to prevent build-time crashes
function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY
          ? process.env.FIREBASE_PRIVATE_KEY.replace(/^["']|["']$/g, "").replace(/\\n/g, "\n")
          : undefined,
      }),
    });
  }
  return getFirestore();
}

export async function POST(req: NextRequest) {
  try {
    const db = getAdminDb(); // Initialize safely on request, not build time
    const body = await req.json();

    // Your webhook event handling logic here...

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}