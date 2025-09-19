import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('brave' in navigator) {
      console.info('[Analytics]: Telemetry is disabled for browser constraints.');
      return;
    }

    // @ts-ignore - window is always defined in the browser and we don't want to type this out.
    if (window.MASTRA_TELEMETRY_DISABLED) {
      console.info('[Analytics]: Telemetry is disabled.');
      return;
    }

    posthog.init('phc_SBLpZVAB6jmHOct9CABq3PF0Yn5FU3G2FgT4xUr2XrT', {
      api_host: 'https://us.posthog.com',
    });

    posthog.register({
      mastraSource: 'playground',
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
