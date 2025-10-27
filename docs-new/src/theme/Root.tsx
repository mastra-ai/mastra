import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { KapaProvider } from "@kapaai/react-sdk";
import { CookieConsent } from "@site/src/components/cookie/cookie-consent";
import { Toaster } from "@site/src/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
  console.log({ children });
  const { siteConfig } = useDocusaurusContext();
  const kapaIntegrationId = siteConfig.customFields.kapaIntegrationId as string;
  return (
    <QueryClientProvider client={queryClient}>
      <KapaProvider integrationId={kapaIntegrationId || ""}>
        <Toaster />
        <CookieConsent />
        {children}
      </KapaProvider>
    </QueryClientProvider>
  );
}
