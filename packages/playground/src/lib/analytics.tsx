import { PostHogProvider as PHProvider } from '@posthog/react';
import posthog from 'posthog-js';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ('brave' in navigator) {
      console.info('[Analytics]: Telemetry is disabled for browser constraints.');
      return;
    }

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
