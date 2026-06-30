/* ============================================================
   Girl Walk — Funnel configuration
   Paste your IDs/URLs here. Anything left "" stays DISABLED
   (its SDK won't load and nothing fires). All values here are
   client-side / publishable (no secret keys).
   ============================================================ */
window.GW_CONFIG = {

  // --- Mixpanel (product analytics) ---
  // Project token from Mixpanel → Settings → Project Settings
  mixpanelToken: "",

  // --- TikTok Pixel (ads attribution) ---
  // Pixel ID from TikTok Events Manager
  tiktokPixelId: "",

  // --- Meta / Facebook Pixel (ads attribution) ---
  // Pixel ID from Meta Events Manager
  metaPixelId: "",

  // --- Adjust (mobile attribution, web SDK) ---
  adjust: {
    appToken: "",                 // Adjust app token
    environment: "production",    // "production" or "sandbox"
    // Optional Adjust event tokens (per-event). Leave "" to skip that event.
    eventTokens: {
      funnelStart:      "",
      initiateCheckout: "",
      purchase:         ""
    }
  },

  // --- Superwall Web Checkout ---
  // Your placement URL (Superwall → Web Checkout → placement).
  // e.g. "https://your-app.superwall.app/checkout/your-placement"
  // The funnel redirects here on "Get my plan", appending quiz + attribution data.
  superwall: {
    checkoutUrl: "https://girlwalk.superwall.app/web2app",
    // If your placement uses Redirect mode and returns to the funnel with a
    // success flag, we fire the Purchase event. Default expected param: ?gw_purchase=1
    purchaseReturnParam: "gw_purchase"
  }
};
