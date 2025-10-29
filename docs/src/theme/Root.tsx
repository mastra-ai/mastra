import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { KapaProvider } from "@kapaai/react-sdk";
import { CookieConsent } from "@site/src/components/cookie/cookie-consent";
import { Toaster } from "@site/src/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PostHogProvider } from "posthog-js/react";
import { GTProvider } from "gt-react";
import loadTranslations from "@site/src/loadTranslations";
import { LocaleSync } from "@site/src/components/gt/LocaleSync";
import React from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function Root({ children }: { children: React.ReactNode }) {
  const { siteConfig, i18n } = useDocusaurusContext();
  const locales = i18n?.locales;
  const kapaIntegrationId = siteConfig.customFields.kapaIntegrationId as string;
  const posthogApiKey = siteConfig.customFields.posthogApiKey as string;
  const posthogHost =
    (siteConfig.customFields.posthogHost as string) ||
    "https://us.i.posthog.com";

  return (
    <QueryClientProvider client={queryClient}>

      <PostHogProvider
        apiKey={posthogApiKey}
        options={{
          api_host: posthogHost,
        }}
      >
        <KapaProvider integrationId={kapaIntegrationId || ""}>
          <GTProvider locales={locales} loadTranslations={loadTranslations}>
            <LocaleSync />
            <Toaster />
            <CookieConsent />
            {children}
          </GTProvider>
        </KapaProvider>
      </PostHogProvider>
    </QueryClientProvider>
  );
}
