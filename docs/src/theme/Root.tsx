import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { KapaProvider } from "@kapaai/react-sdk";
import { CookieConsent } from "@site/src/components/cookie/cookie-consent";
import { Toaster } from "@site/src/components/ui/sonner";
import { PostHogProvider } from "posthog-js/react";
import React from "react";
import { ChatbotSidebarProvider } from "./DocRoot/Layout/ChatbotSidebar/context";

export default function Root({ children }: { children: React.ReactNode }) {
  const { siteConfig } = useDocusaurusContext();
  const kapaIntegrationId = siteConfig.customFields.kapaIntegrationId as string;
  const kapaGroupId = siteConfig.customFields.kapaGroupId as string;
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
      <KapaProvider
        integrationId={kapaIntegrationId || ""}
        sourceGroupIDsInclude={[kapaGroupId]}
      >
        <Toaster />
        <CookieConsent />
        <ChatbotSidebarProvider defaultHidden={true}>
          {children}
        </ChatbotSidebarProvider>
      </KapaProvider>
    </PostHogProvider>
  );
}
