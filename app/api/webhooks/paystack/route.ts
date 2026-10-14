import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const bodyText = await request.text();
    const signature = request.headers.get("x-paystack-signature");

    // Verify signature to ensure it's genuinely from Paystack
    const secret = process.env.PAYSTACK_SECRET_KEY || "";
    const hash = crypto
      .createHmac("sha512", secret)
      .update(bodyText)
      .digest("hex");

    if (hash !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(bodyText);

    // Handle successful charges (e.g., upgrading user tier or adding credits)
    if (event.event === "charge.success") {
      const transactionData = event.data;
      const customerEmail = transactionData.customer.email;
      const planType = transactionData.metadata?.planType;

      console.log(`Payment successful for ${customerEmail} on plan: ${planType}`);

      // TODO: Add your database update logic here to grant user pro access or credits
    }

    // Always return a 200 OK response quickly so Paystack knows you received it
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}