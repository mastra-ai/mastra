import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect, useState } from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";

export function PostHogWrapper({ children }: { children: React.ReactNode }) {
  const { siteConfig } = useDocusaurusContext();
  const [isInitialized, setIsInitialized] = useState(false);

  const posthogApiKey = siteConfig.customFields.posthogApiKey as string;
  const posthogHost =
    (siteConfig.customFields.posthogHost as string) ||
    "https://us.i.posthog.com";

  useEffect(() => {
    // Only initialize on client-side
    if (typeof window === "undefined") return;

    // Only initialize if API key is present
    if (!posthogApiKey) {
      console.warn("PostHog API key not found");
      setIsInitialized(true); // Set to true anyway to render children
      return;
    }

    // Initialize PostHog manually to avoid Next.js runtime checks
    if (!posthog.__loaded) {
      posthog.init(posthogApiKey, {
        api_host: posthogHost,
        // Enable automatic pageview capture
        capture_pageview: true,
        // Disable session recording by default for privacy
        disable_session_recording: true,
        // Respect Do Not Track
        respect_dnt: true,
        loaded: (posthog) => {
          if (process.env.NODE_ENV === "development") {
            console.log("PostHog loaded successfully");
          }
        },
      });
    }

    setIsInitialized(true);
  }, [posthogApiKey, posthogHost]);

  // Don't render children until PostHog is initialized to avoid hook errors
  if (!isInitialized) {
    return <>{children}</>;
  }

  // Provide the PostHog client to hooks
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
