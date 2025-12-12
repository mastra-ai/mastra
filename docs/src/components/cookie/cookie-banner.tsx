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
  const [showBanner, setShowBanner] = useState(null);
  const isBrowser = useIsBrowser();

  // Try to use feature flag, but default to true if undefined
  // This ensures the banner works even if PostHog isn't properly initialized
  const featureFlag = useFeatureFlagEnabled("cookie-banner");
  const isInEU = featureFlag !== undefined ? featureFlag : false;

  useEffect(() => {
    if (!isBrowser) return;

    if (!isInEU) {
      setShowBanner(false);
      onConsentChange(true);
      window.gtag?.("consent", "update", {
        analytics_storage: "granted",
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
      });
      return;
    } else {
      setShowBanner(true);
    }
  }, [isInEU, isBrowser]);

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

  if (showBanner === null) return null;
  if (showBanner === false) return null;

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
