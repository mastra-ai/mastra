/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import useIsBrowser from '@docusaurus/useIsBrowser';
import { Button } from '../ui/button';
import { useFeatureFlagEnabled } from 'posthog-js/react';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export function CookieBanner({ onConsentChange }: { onConsentChange: (consent: boolean) => void }) {
  const [showBanner, setShowBanner] = useState(false);
  const isBrowser = useIsBrowser();

  // PostHog hook is safe to call - returns undefined during SSR
  // The posthog-docusaurus plugin provides PostHogProvider
  const isEUFlag = useFeatureFlagEnabled('cookie-banner');

  // Only trust the flag value when in browser
  const isEU = isBrowser ? isEUFlag : undefined;

  useEffect(() => {
    if (isEU === undefined) return;

    if (isEU === false) {
      const storedConsent = localStorage.getItem('cookie-consent');
      if (!storedConsent) {
        window.gtag?.('consent', 'update', {
          analytics_storage: 'granted',
          ad_storage: 'granted',
          ad_user_data: 'granted',
          ad_personalization: 'granted',
        });
        localStorage.setItem('cookie-consent', 'true');
        onConsentChange(true);
      } else {
        onConsentChange(storedConsent === 'true');
      }
      return;
    }

    const storedConsent = localStorage.getItem('cookie-consent');
    if (!storedConsent) {
      setShowBanner(true);
      window.gtag?.('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
      return;
    }
    onConsentChange(storedConsent === 'true');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEU]);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'true');
    onConsentChange(true);
    window.gtag?.('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    });
    setShowBanner(false);
  };

  const handleReject = () => {
    localStorage.setItem('cookie-consent', 'false');
    onConsentChange(false);
    window.gtag?.('consent', 'update', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-8 right-5 z-50 flex w-[322px] items-center justify-center rounded-xl dark:border-neutral-700 border bg-white dark:bg-black p-4">
      <div>
        <p className="mb-4 font-sans dark:text-white text-sm">
          We use tracking cookies to understand how you use the product and help us improve it. Please accept cookies to
          help us improve.
        </p>
        <Button size={'slim'} type="button" onClick={handleAccept}>
          Accept cookies
        </Button>
        <span> </span>
        <Button variant={'secondary'} className="dark:text-white" size={'slim'} type="button" onClick={handleReject}>
          Decline cookies
        </Button>
      </div>
    </div>
  );
}
