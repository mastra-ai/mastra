/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Script from "next/script";
import { useState } from "react";
import { CookieBanner } from "./cookie-banner";
import HubspotTracker from "./hubspot-tracker";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export const CookieConsent = () => {
  const [cookieConsent, setCookieConsent] = useState<boolean | null>(null);
  const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
  const HS_PORTAL_ID = process.env.NEXT_PUBLIC_HS_PORTAL_ID;

  if (!GA_ID) {
    console.warn("Google Analytics ID is not defined");
  }
  if (!HS_PORTAL_ID) {
    console.warn("Hubspot Portal ID is not defined");
  }

  return (
    <>
      <CookieBanner onConsentChange={setCookieConsent} />
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}', {
                'cookie_flags': 'SameSite=Lax;Secure'
              });
            `}
      </Script>

      <Script
        id="hs-script-loader"
        strategy="afterInteractive"
        src={`//js.hs-scripts.com/${HS_PORTAL_ID}.js`}
      />

      {cookieConsent === false && (
        <>
          <Script id="hubspot-gdpr" strategy="afterInteractive">
            {`
              var _hsq = window._hsq = window._hsq || [];
              _hsq.push(['doNotTrack']);
            `}
          </Script>
        </>
      )}

      <HubspotTracker cookieConsent={cookieConsent ?? false} />
    </>
  );
};
