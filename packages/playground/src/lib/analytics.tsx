import { PostHogProvider as PHProvider } from '@posthog/react';
import posthog from 'posthog-js';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

const TRUTHY_DISABLED_VALUES = ['1', 'true', 'yes'];
const POSTHOG_ALLOWED_HOSTNAME = /(?:^|\.)mastra\.cloud$/;

function isTelemetryDisabled(): boolean {
  const value = window.MASTRA_TELEMETRY_DISABLED;
  if (!value) {
    return false;
  }
  return TRUTHY_DISABLED_VALUES.includes(value.trim().toLowerCase());
}

function isPostHogAllowedHost(hostname: string): boolean {
  return POSTHOG_ALLOWED_HOSTNAME.test(hostname.toLowerCase());
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ('brave' in navigator) {
      console.info('[Analytics]: Telemetry is disabled for browser constraints.');
      return;
    }

    if (isTelemetryDisabled()) {
      console.info('[Analytics]: Telemetry is disabled.');
      return;
    }

    if (!isPostHogAllowedHost(window.location.hostname)) {
      console.info('[Analytics]: Telemetry is disabled for this host.');
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
