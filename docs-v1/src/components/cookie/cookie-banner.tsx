/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import useIsBrowser from "@docusaurus/useIsBrowser";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { Button } from "../ui/button";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export function CookieBanner({
  onConsentChange,
}: {
  onConsentChange: (consent: boolean) => void;
}) {
  const [showBanner, setShowBanner] = useState(false);
  const isBrowser = useIsBrowser();

  // Try to use feature flag, but default to true if undefined
  // This ensures the banner works even if PostHog isn't properly initialized
  const featureFlag = useFeatureFlagEnabled("cookie-banner");
  const banner = featureFlag !== undefined ? featureFlag : true;

  useEffect(() => {
    if (!isBrowser) return;

    const storedConsent = localStorage.getItem("cookie-consent");

    // If feature flag is enabled and no consent stored, show banner
    if (banner && !storedConsent) {
      setShowBanner(true);
      // Default to denied until user makes a choice
      window.gtag?.("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
      return;
    }

    // If we have stored consent, apply it
    if (storedConsent) {
      const isConsented = storedConsent === "true";
      onConsentChange(isConsented);

      if (isConsented) {
        window.gtag?.("consent", "update", {
          analytics_storage: "granted",
          ad_storage: "granted",
          ad_user_data: "granted",
          ad_personalization: "granted",
        });
      } else {
        window.gtag?.("consent", "update", {
          analytics_storage: "denied",
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banner, isBrowser]);

  const handleAccept = () => {
    localStorage.setItem("cookie-consent", "true");
    onConsentChange(true);
    window.gtag?.("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    });
    setShowBanner(false);
  };

  const handleReject = () => {
    localStorage.setItem("cookie-consent", "false");
    onConsentChange(false);
    window.gtag?.("consent", "update", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    setShowBanner(false);
  };

  // Only show banner if both the feature flag is enabled and we should show it
  if (!showBanner || !banner) return null;

  return (
    <div className="fixed shadow-[0_4px_24px_rgba(0,0,0,.1)] bottom-8 right-20 z-50 flex w-[322px] items-center justify-center rounded-xl dark:border-neutral-700 dark:border bg-white dark:bg-black p-4">
      <div>
        <p className="mb-4 font-sans dark:text-white text-sm">
          We use tracking cookies to understand how you use the product and help
          us improve it. Please accept cookies to help us improve.
        </p>
        <Button
          variant="secondary"
          size={"slim"}
          type="button"
          onClick={handleAccept}
          className="bg-black text-white dark:bg-white dark:text-black"
        >
          Accept cookies
        </Button>
        <span> </span>
        <Button
          variant={"secondary"}
          className="dark:text-white"
          size={"slim"}
          type="button"
          onClick={handleReject}
        >
          Decline cookies
        </Button>
      </div>
    </div>
  );
}
