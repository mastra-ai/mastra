/* eslint-disable @typescript-eslint/no-explicit-any */
import Head from "@docusaurus/Head";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { useEffect, useState } from "react";
import { CookieBanner } from "./cookie-banner";
import HubspotTracker from "./hubspot-tracker";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

const REO_SCRIPT_ID = "reo-script";
const REO_CLIENT_ID = "fdd9258c52d6769";

export const CookieConsent = () => {
  const { siteConfig } = useDocusaurusContext();
  const [cookieConsent, setCookieConsent] = useState<boolean | null>(null);
  const [
    hasGottenConsentForGoogleTracking,
    setHasGottenConsentForGoogleTracking,
  ] = useState<boolean>(false);
  const [
    hasGottenConsentForHubspotTracking,
    setHasGottenConsentForHubspotTracking,
  ] = useState<boolean>(false);

  const GA_ID = siteConfig.customFields?.gaId as string | undefined;
  const HS_PORTAL_ID = siteConfig.customFields?.hsPortalId as
    | string
    | undefined;

  if (!GA_ID) {
    console.warn("Google Analytics ID is not defined");
  }
  if (!HS_PORTAL_ID) {
    console.warn("Hubspot Portal ID is not defined");
  }

  useEffect(() => {
    if (cookieConsent) {
      setHasGottenConsentForGoogleTracking(true);
      setHasGottenConsentForHubspotTracking(true);
    }
  }, [cookieConsent]);

  return (
    <>
      <CookieBanner onConsentChange={setCookieConsent} />

      {hasGottenConsentForGoogleTracking ? (
        <>
          <Head>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            />
            <script>
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', {
                  'cookie_flags': 'SameSite=Lax;Secure'
                });
              `}
            </script>
          </Head>
        </>
      ) : null}

      {/* HubSpot - Only load with consent */}
      {hasGottenConsentForHubspotTracking ? (
        <Head>
          <script
            async
            src={`//js.hs-scripts.com/${HS_PORTAL_ID}.js`}
            id="hs-script-loader"
          />
        </Head>
      ) : null}

      {/* HubSpot - Tell it not to track if consent denied */}
      {!hasGottenConsentForHubspotTracking ? (
        <Head>
          <script id="hubspot-gdpr">
            {`
              var _hsq = window._hsq = window._hsq || [];
              _hsq.push(['doNotTrack']);
            `}
          </script>
        </Head>
      ) : null}

      {/* Reo.dev tracking - Only load with consent */}
      {cookieConsent && (
        <Head>
          <script id={REO_SCRIPT_ID}>
            {`!function(){var e,t,n;e="${REO_CLIENT_ID}",t=function(){Reo.init({clientID:"${REO_CLIENT_ID}"})},
            (n=document.createElement("script")).src="https://static.reo.dev/"+e+"/reo.js",n.defer=!0,
            n.onload=t,document.head.appendChild(n)}();`}
          </script>
        </Head>
      )}

      <HubspotTracker cookieConsent={cookieConsent ?? false} />
    </>
  );
};
