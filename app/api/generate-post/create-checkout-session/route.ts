import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { planType, userEmail } = await request.json();

    // Paystack amounts are in Kobo (1 NGN = 100 Kobo)
    // Pro Tier: ₦15,000 (~$10-15/mo) | Credit Pack: ₦3,500
    const amountInKobo = planType === "pro" ? 1500000 : 350000;

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: userEmail || "developer@example.com",
        amount: amountInKobo,
        currency: "NGN",
        callback_url: `${request.headers.get("origin")}?success=true`,
        metadata: {
          planType,
          custom_fields: [
            {
              display_name: "Plan Name",
              variable_name: "plan_name",
              value: planType === "pro" ? "CommitToPost Pro Tier" : "Credit Top-Up Pack",
            },
          ],
        },
      }),
    });

    const data = await response.json();

    if (data.status && data.data.authorization_url) {
      return NextResponse.json({ url: data.data.authorization_url });
    } else {
      console.error("Paystack API error:", data);
      return NextResponse.json(
        { error: data.message || "Failed to initialize Paystack transaction." },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Paystack server error:", error);
    return NextResponse.json({ error: "Server error creating payment session." }, { status: 500 });
  }
}