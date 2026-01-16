import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { KapaProvider } from "@kapaai/react-sdk";
import { PostHogWrapper } from "@site/src/components/analytics/posthog-wrapper";
import { CookieConsent } from "@site/src/components/cookie/cookie-consent";
import { Toaster } from "@site/src/components/ui/sonner";
import loadTranslations from "@site/src/loadTranslations";
import { GTProvider } from "gt-react";
import React from "react";
import { ChatbotSidebarProvider } from "./DocRoot/Layout/ChatbotSidebar/context";

export default function Root({ children }: { children: React.ReactNode }) {
  // We use Docusaurus as the source of truth for i18n locales
  const { siteConfig, i18n } = useDocusaurusContext();
  const locales = i18n?.locales;
  const kapaIntegrationId = siteConfig.customFields.kapaIntegrationId as string;
  const kapaGroupId = siteConfig.customFields.kapaGroupId as string | undefined;

  return (
    <PostHogWrapper>
      <KapaProvider
        integrationId={kapaIntegrationId || ""}
        {...(kapaGroupId && { sourceGroupIDsInclude: [kapaGroupId] })}
      >
        {/* Adding GTProvider to the root of the app to ensure all jsx is translated */}
        <GTProvider
          locales={locales}
          // Ensure SSR markup matches client by using Docusaurus locale
          locale={i18n?.currentLocale}
          defaultLocale={i18n?.defaultLocale}
          loadTranslations={loadTranslations}
          // Explicitly disable SSR detection to prevent process.env.NEXT_RUNTIME errors
          ssr={false}
        >
          <Toaster />
          <CookieConsent />
          <ChatbotSidebarProvider defaultHidden={true}>
            {children}
          </ChatbotSidebarProvider>
        </GTProvider>
      </KapaProvider>
    </PostHogWrapper>
  );
}
