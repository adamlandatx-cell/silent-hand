// supabase/functions/donate/index.ts
// ────────────────────────────────────
// Takes a donation amount + metadata from the frontend
// and creates a REAL Stripe PaymentIntent (test mode).
// This charge shows up in your Stripe Dashboard immediately.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, restaurant, charity, donationType, originalBill } = await req.json();

    if (!amount || amount <= 0) {
      throw new Error("Invalid donation amount");
    }

    const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    if (!STRIPE_KEY) {
      throw new Error("Stripe key not configured");
    }

    const amountInCents = Math.round(amount * 100);

    if (amountInCents < 50) {
      throw new Error("Minimum donation is $0.50");
    }

    const res = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        amount: String(amountInCents),
        currency: "usd",
        payment_method: "pm_card_visa",
        confirm: "true",
        "automatic_payment_methods[enabled]": "true",
        "automatic_payment_methods[allow_redirects]": "never",
        description: `Silent Hand: ${donationType} donation from ${restaurant}`,
        "metadata[app]": "Silent Hand",
        "metadata[restaurant]": restaurant || "Unknown",
        "metadata[charity]": charity || "General Fund",
        "metadata[donation_type]": donationType || "round-up",
        "metadata[original_bill]": String(originalBill || 0),
      }),
    });

    const intent = await res.json();

    if (intent.error) {
      throw new Error(intent.error.message);
    }

    return new Response(
      JSON.stringify({
        success: intent.status === "succeeded",
        paymentId: intent.id,
        amount: intent.amount / 100,
        status: intent.status,
        charity: charity,
        restaurant: restaurant,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
