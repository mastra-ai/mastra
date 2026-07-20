import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PostHog } from 'posthog-node';

/**
 * Minimal PostHog analytics for create-factory, mirroring the
 * create-mastra pattern (same project key, same opt-out env var, same
 * ~/.mastra/analytics.json distinct-id store).
 */

const ANALYTICS_CONFIG_PATH = path.join(os.homedir(), '.mastra', 'analytics.json');
const POSTHOG_API_KEY = 'phc_SBLpZVAB6jmHOct9CABq3PF0Yn5FU3G2FgT4xUr2XrT';
const POSTHOG_HOST = 'https://us.posthog.com';

function isTelemetryEnabled(): boolean {
  const value = process.env.MASTRA_TELEMETRY_DISABLED;
  return !(value && value !== '0' && value.toLowerCase() !== 'false');
}

function getOrCreateDistinctId(): string {
  try {
    if (existsSync(ANALYTICS_CONFIG_PATH)) {
      const { distinctId } = JSON.parse(readFileSync(ANALYTICS_CONFIG_PATH, 'utf-8')) as { distinctId?: string };
      if (distinctId) return distinctId;
    }
  } catch {
    // fall through to create
  }
  const distinctId = randomUUID();
  try {
    mkdirSync(path.dirname(ANALYTICS_CONFIG_PATH), { recursive: true });
    writeFileSync(ANALYTICS_CONFIG_PATH, JSON.stringify({ distinctId, sessionId: randomUUID() }, null, 2));
  } catch {
    // best-effort persistence only
  }
  return distinctId;
}

export class Analytics {
  private client?: PostHog;
  private distinctId = '';

  constructor(private version: string) {
    if (!isTelemetryEnabled()) return;
    try {
      this.distinctId = getOrCreateDistinctId();
      this.client = new PostHog(POSTHOG_API_KEY, { host: POSTHOG_HOST, flushAt: 1, flushInterval: 100 });
    } catch {
      this.client = undefined;
    }
  }

  trackEvent(event: string, properties: Record<string, unknown> = {}): void {
    try {
      this.client?.capture({
        distinctId: this.distinctId,
        event,
        properties: { ...properties, cli: 'create-factory', version: this.version },
      });
    } catch {
      // analytics must never break the CLI
    }
  }

  async shutdown(timeoutMs = 1000): Promise<void> {
    if (!this.client) return;
    try {
      await Promise.race([this.client.shutdown(), new Promise(resolve => setTimeout(resolve, timeoutMs))]);
    } catch {
      // ignore
    }
  }
}
