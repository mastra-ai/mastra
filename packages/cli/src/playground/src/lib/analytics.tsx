import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (import.meta.env.VITE_NO_MASTRA_TELEMETRY) {
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
