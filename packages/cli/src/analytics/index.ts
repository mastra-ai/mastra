import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PostHog } from 'posthog-node';
import { getPackageManager } from '../commands/utils.js';

const ANALYTICS_CONFIG_PATH = path.join(os.homedir(), '.mastra', 'analytics.json');

interface CommandData {
  command: string;
  args?: Record<string, unknown>;
  durationMs?: number;
  status: 'success' | 'error';
  error?: string;
}

export type CLI_ORIGIN = 'mastra-cloud' | 'oss';

let analyticsInstance: PosthogAnalytics | null = null;

export function getAnalytics(): PosthogAnalytics | null {
  return analyticsInstance;
}

export function setAnalytics(instance: PosthogAnalytics): void {
  analyticsInstance = instance;
}

export class PosthogAnalytics {
  private sessionId: string = '';
  private client?: PostHog;
  private distinctId: string = '';
  private version: string;
  private packageManager: string = '';

  constructor({
    version,
    apiKey,
    host = 'https://app.posthog.com',
  }: {
    version: string;
    apiKey: string;
    host: string;
  }) {
    this.version = version;

    if (!PosthogAnalytics.isTelemetryEnabled()) {
      return;
    }

    this.packageManager = getPackageManager();
    const { distinctId, sessionId } = this.getOrCreateAnalyticsConfig();
    this.distinctId = distinctId;
    this.sessionId = sessionId;

    this.initializePostHog(apiKey, host);
  }

  private getOrCreateAnalyticsConfig(configPath = ANALYTICS_CONFIG_PATH): { distinctId: string; sessionId: string } {
    try {
      if (existsSync(configPath)) {
        const { distinctId, sessionId } = JSON.parse(readFileSync(configPath, 'utf-8')) as {
          distinctId?: string;
          sessionId?: string;
        };
        if (distinctId && !this.isHostnameDerivedDistinctId(distinctId)) {
          const config = {
            distinctId,
            sessionId: sessionId || randomUUID(),
          };
          if (config.sessionId !== sessionId) {
            this.writeCliConfig(config, configPath);
          }
          return config;
        }
      }
    } catch {
      // regenerate below
    }

    const config = {
      distinctId: this.createDistinctId(),
      sessionId: randomUUID(),
    };
    this.writeCliConfig(config, configPath);
    return config;
  }

  private writeCliConfig(
    { distinctId, sessionId }: { distinctId: string; sessionId: string },
    configPath = ANALYTICS_CONFIG_PATH,
  ): void {
    try {
      mkdirSync(path.dirname(configPath), { recursive: true });
      writeFileSync(configPath, JSON.stringify({ distinctId, sessionId }));
    } catch {
      //swallow
    }
  }

  private initializePostHog(apiKey: string, host: string): void {
    this.client = new PostHog(apiKey, {
      host,
      flushAt: 1,
      flushInterval: 0,
      disableGeoip: false,
    });

    this.captureSessionStart();

    process.on('exit', () => {
      this.client?.flush().catch(() => {});
    });
  }

  private static isTelemetryEnabled(): boolean {
    const value = process.env.MASTRA_TELEMETRY_DISABLED;
    if (value && ['1', 'true', 'yes'].includes(value.trim().toLowerCase())) {
      return false;
    }
    return true;
  }

  private createDistinctId(): string {
    return `mastra-${randomUUID()}`;
  }

  private isHostnameDerivedDistinctId(distinctId: string): boolean {
    return distinctId === `mastra-${os.hostname()}`;
  }

  private getSystemProperties(): Record<string, any> {
    return {
      os: process.platform,
      os_version: os.release(),
      node_version: process.version,
      platform: process.arch,
      session_id: this.sessionId,
      cli_version: this.version || 'unknown',
      machine_id: os.hostname(),
      package_manager: this.packageManager,
    };
  }
  private getDurationMs(startTime: [number, number]): number {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    return seconds * 1000 + nanoseconds / 1_000_000;
  }

  private captureSessionStart(): void {
    if (!this.client) {
      return;
    }

    this.client.capture({
      distinctId: this.distinctId,
      event: 'cli_session_start',
      properties: {
        ...this.getSystemProperties(),
      },
    });
  }

  getDistinctId(): string {
    return this.distinctId;
  }

  trackEvent(eventName: string, properties?: Record<string, any>): void {
    try {
      if (!this.client) {
        return;
      }

      this.client.capture({
        distinctId: this.distinctId,
        event: eventName,
        properties: {
          ...this.getSystemProperties(),
          ...properties,
        },
      });
    } catch {
      //swallow
    }
  }

  trackCommand(options: {
    command: string;
    args?: Record<string, unknown>;
    durationMs?: number;
    status?: 'success' | 'error';
    error?: string;
    origin?: CLI_ORIGIN;
  }): void {
    try {
      if (!this.client) {
        return;
      }

      const commandData: CommandData = {
        command: options.command,
        status: options.status || 'success',
      };

      if (options.args) {
        commandData.args = options.args;
      }

      if (options.durationMs !== undefined) {
        commandData.durationMs = options.durationMs;
      }

      if (options.error) {
        commandData.error = options.error;
      }

      this.client.capture({
        distinctId: this.distinctId,
        event: 'cli_command',
        properties: {
          ...this.getSystemProperties(),
          ...commandData,
          origin: options?.origin || 'oss',
        },
      });
    } catch {
      //swallow
    }
  }

  // Helper method to wrap command execution with timing
  async trackCommandExecution<T>({
    command,
    args,
    execution,
    origin,
  }: {
    command: string;
    args: Record<string, unknown>;
    execution: () => Promise<T>;
    origin?: CLI_ORIGIN;
  }): Promise<T> {
    const startTime = process.hrtime();

    try {
      const result = await execution();
      const durationMs = this.getDurationMs(startTime);
      this.trackCommand({
        command,
        args,
        durationMs,
        status: 'success',
        origin,
      });

      return result;
    } catch (error) {
      const durationMs = this.getDurationMs(startTime);
      this.trackCommand({
        command,
        args,
        durationMs,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        origin,
      });

      throw error;
    }
  }

  // Ensure PostHog client is shutdown properly
  async shutdown(timeoutMs?: number): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      await this.client.shutdown(timeoutMs);
    } catch {
      //swallow
    }
  }
}
