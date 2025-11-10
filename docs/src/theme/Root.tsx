import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { KapaProvider } from "@kapaai/react-sdk";
import { CookieConsent } from "@site/src/components/cookie/cookie-consent";
import { Toaster } from "@site/src/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PostHogProvider } from "posthog-js/react";
import { GTProvider } from "gt-react";
import loadTranslations from "@site/src/loadTranslations";
import React from "react";

export default function Root({ children }: { children: React.ReactNode }) {
  // We use Docusaurus as the source of truth for i18n locales
  const { siteConfig, i18n } = useDocusaurusContext();
  const locales = i18n?.locales;
  const kapaIntegrationId = siteConfig.customFields.kapaIntegrationId as string;
  const posthogApiKey = siteConfig.customFields.posthogApiKey as string;
  const posthogHost =
    (siteConfig.customFields.posthogHost as string) ||
    "https://us.i.posthog.com";

  return (
    <PostHogProvider
      apiKey={posthogApiKey}
      options={{
        api_host: posthogHost,
      }}
    >
      <KapaProvider integrationId={kapaIntegrationId || ""}>
        {/* Adding GTProvider to the root of the app to ensure all jsx is translated */}
        <GTProvider
          locales={locales}
          // Ensure SSR markup matches client by using Docusaurus locale
          locale={i18n?.currentLocale}
          defaultLocale={i18n?.defaultLocale}
          loadTranslations={loadTranslations}
        >
          <Toaster />
          <CookieConsent />
          {children}
        </GTProvider>
      </KapaProvider>
    </PostHogProvider>
  );
}
