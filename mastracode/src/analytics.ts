import { randomUUID } from 'node:crypto';
import os from 'node:os';

import { PostHog } from 'posthog-node';

const POSTHOG_API_KEY = 'phc_SBLpZVAB6jmHOct9CABq3PF0Yn5FU3G2FgT4xUr2XrT';
const POSTHOG_HOST = 'https://us.posthog.com';
const MASTRA_SOURCE = 'mastracode';
const TRUTHY_DISABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

export type MastraCodeAnalyticsEvent =
  | 'mastracode_session_started'
  | 'mastracode_prompt_submitted'
  | 'mastracode_thread_changed'
  | 'mastracode_model_changed'
  | 'mastracode_command_used'
  | 'mastracode_interactive_prompt_shown';

export interface MastraCodeAnalytics {
  capture(event: MastraCodeAnalyticsEvent, properties?: Record<string, unknown>): void;
  trackCommand(command: string, properties?: Record<string, unknown>): void;
  trackInteractivePrompt(promptType: string, properties?: Record<string, unknown>): void;
  shutdown(): Promise<void>;
  isEnabled(): boolean;
}

interface MastraCodeAnalyticsOptions {
  version: string;
  host?: string;
  apiKey?: string;
}

class NoopMastraCodeAnalytics implements MastraCodeAnalytics {
  capture(): void {}
  trackCommand(): void {}
  trackInteractivePrompt(): void {}
  async shutdown(): Promise<void> {}
  isEnabled(): boolean {
    return false;
  }
}

class PostHogMastraCodeAnalytics implements MastraCodeAnalytics {
  private readonly client: PostHog;
  private readonly distinctId: string;
  private readonly sessionId = randomUUID();
  private readonly version: string;

  constructor({ version, apiKey = POSTHOG_API_KEY, host = POSTHOG_HOST }: MastraCodeAnalyticsOptions) {
    this.version = version;
    this.distinctId = `mastracode-${os.hostname()}`;
    this.client = new PostHog(apiKey, {
      host,
      flushAt: 1,
      flushInterval: 0,
      disableGeoip: false,
    });
    this.client.register({ mastraSource: MASTRA_SOURCE });
  }

  capture(event: MastraCodeAnalyticsEvent, properties?: Record<string, unknown>): void {
    try {
      this.client.capture({
        distinctId: this.distinctId,
        event,
        properties: {
          ...this.getBaseProperties(),
          ...properties,
        },
      });
    } catch {
      // swallow analytics errors
    }
  }

  trackCommand(command: string, properties?: Record<string, unknown>): void {
    this.capture('mastracode_command_used', { command, ...properties });
  }

  trackInteractivePrompt(promptType: string, properties?: Record<string, unknown>): void {
    this.capture('mastracode_interactive_prompt_shown', { promptType, ...properties });
  }

  async shutdown(): Promise<void> {
    try {
      await this.client.shutdown();
    } catch {
      // swallow analytics errors
    }
  }

  isEnabled(): boolean {
    return true;
  }

  private getBaseProperties(): Record<string, unknown> {
    return {
      mastraSource: MASTRA_SOURCE,
      sessionId: this.sessionId,
      version: this.version,
      os: process.platform,
      osVersion: os.release(),
      nodeVersion: process.version,
      platform: process.arch,
      machineId: os.hostname(),
    };
  }
}

export function isTelemetryDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.MASTRA_TELEMETRY_DISABLED;
  if (!value) {
    return false;
  }

  return TRUTHY_DISABLED_VALUES.has(value.trim().toLowerCase());
}

export function createMastraCodeAnalytics(options: MastraCodeAnalyticsOptions): MastraCodeAnalytics {
  if (isTelemetryDisabled()) {
    return new NoopMastraCodeAnalytics();
  }

  return new PostHogMastraCodeAnalytics(options);
}
