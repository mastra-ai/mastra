import { useState, useEffect } from "react";
import { Button } from "./ui/button";

import { useFeatureFlagEnabled } from "posthog-js/react";

export function CookieBanner({
  onConsentChange,
}: {
  onConsentChange: (consent: boolean) => void;
}) {
  const [showBanner, setShowBanner] = useState(false);
  const flag = useFeatureFlagEnabled("cookie-banner");

  useEffect(() => {
    if (!flag) {
      setShowBanner(false);
      window.gtag?.("consent", "update", {
        analytics_storage: "granted",
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
      });
      localStorage.setItem("cookie-consent", "true");
      onConsentChange(true);
      return;
    }
    const storedConsent = localStorage.getItem("cookie-consent");
    if (!storedConsent) {
      setShowBanner(true);
      window.gtag?.("consent", "default", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied",
      });
    } else {
      const consent = storedConsent === "true";
      onConsentChange(consent);
      if (consent) {
        window.gtag?.("consent", "update", {
          analytics_storage: "granted",
          ad_storage: "granted",
          ad_user_data: "granted",
          ad_personalization: "granted",
        });
      }
    }
  }, [flag]);

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

  if (!showBanner) return null;

  return (
    <div className="border-border-1 fixed bottom-8 right-5 z-50 flex w-[322px] items-center justify-center rounded-xl border bg-black p-4">
      <div>
        <p className="mb-4 font-sans text-sm">
          We use tracking cookies to understand how you use the product and help
          us improve it. Please accept cookies to help us improve.
        </p>
        <Button size={"slim"} type="button" onClick={handleAccept}>
          Accept cookies
        </Button>
        <span> </span>
        <Button
          variant={"secondary"}
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
