import { NextResponse } from "next/server";
import crypto from "crypto";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin securely on the server
if (!getApps().length) {
  initializeApp({
    // If using service account credentials file, or let Firebase auto-detect from environment
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Replace escaped newlines if private key is stored as a string in env
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-paystack-signature");

    // 1. Verify Paystack signature for security
    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY || "")
      .update(rawBody)
      .digest("hex");

    if (hash !== signature) {
      return NextResponse.json({ error: "Invalid Paystack signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    // 2. Handle successful payment event
    if (event.event === "charge.success") {
      const { customer, metadata } = event.data;
      const userEmail = customer.email;
      const planType = metadata?.planType; // "pro" or credit pack

      console.log(`✅ Payment verified for ${userEmail} [Plan: ${planType}]`);

      // 3. Query Firestore to find the user by email
      const usersRef = db.collection("users");
      const snapshot = await usersRef.where("email", "==", userEmail).get();

      if (snapshot.empty) {
        console.warn(`⚠️ Payment received, but no Firestore user found for email: ${userEmail}`);
      } else {
        // Update user's subscription or credits
        snapshot.forEach(async (doc) => {
          const userRef = doc.ref;
          const userData = doc.data();

          if (planType === "pro") {
            await userRef.update({
              isPro: true,
              plan: "pro",
              updatedAt: new Date().toISOString(),
            });
            console.log(`🚀 Upgraded ${userEmail} to Pro!`);
          } else {
            // Standard credit top-up (e.g., +50 credits)
            const currentCredits = userData.credits || 10;
            await userRef.update({
              credits: currentCredits + 50,
              updatedAt: new Date().toISOString(),
            });
            console.log(`⚡ Credited 50 points to ${userEmail}!`);
          }
        });
      }
    }

    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
} 