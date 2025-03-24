import { randomUUID } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { PostHog } from 'posthog-node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CommandData {
  command: string;
  args?: Record<string, unknown>;
  durationMs?: number;
  status: 'success' | 'error';
  error?: string;
}

export class PosthogAnalytics {
  private sessionId: string;
  private client?: PostHog;
  private distinctId: string;
  private version: string;

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
    const cliConfigPath = path.join(__dirname, 'mastra-cli.json');
    if (existsSync(cliConfigPath)) {
      try {
        const { distinctId, sessionId } = JSON.parse(readFileSync(cliConfigPath, 'utf-8'));
        this.distinctId = distinctId;
        this.sessionId = sessionId;
      } catch {
        this.sessionId = randomUUID();
        this.distinctId = this.getDistinctId();
      }

      this.writeCliConfig({
        distinctId: this.distinctId,
        sessionId: this.sessionId,
      });
    } else {
      this.sessionId = randomUUID();
      this.distinctId = this.getDistinctId();
      this.writeCliConfig({
        distinctId: this.distinctId,
        sessionId: this.sessionId,
      });
    }

    if (this.isTelemetryEnabled()) {
      this.initializePostHog(apiKey, host);
    }
  }

  private writeCliConfig({ distinctId, sessionId }: { distinctId: string; sessionId: string }): void {
    try {
      writeFileSync(path.join(__dirname, 'mastra-cli.json'), JSON.stringify({ distinctId, sessionId }));
    } catch {
      //swallow
    }
  }

  private initializePostHog(apiKey: string, host: string): void {
    this.client = new PostHog(apiKey, {
      host,
      flushAt: 1,
      flushInterval: 0,
    });

    this.captureSessionStart();

    process.on('exit', () => {
      this.client?.flush().catch(() => {});
    });
  }

  private isTelemetryEnabled(): boolean {
    // Check environment variable first
    if (process.env.NO_MASTRA_TELEMETRY) {
      return false;
    }
    // Default to enabled
    return true;
  }

  private getDistinctId(): string {
    // Use machine-id or generate a persistent ID
    // This helps track unique CLI installations
    const machineId = os.hostname();
    return `mastra-${machineId}`;
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
    };
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

  trackCommand(options: {
    command: string;
    args?: Record<string, unknown>;
    durationMs?: number;
    status?: 'success' | 'error';
    error?: string;
    origin?: 'mastra-cloud' | 'oss';
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

      if (options.durationMs) {
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
          origin: options.origin || 'oss',
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
    origin?: 'mastra-cloud' | 'oss';
  }): Promise<T> {
    const startTime = process.hrtime();

    try {
      const result = await execution();
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const durationMs = seconds * 1000 + nanoseconds / 1000000;

      this.trackCommand({
        command,
        args,
        durationMs,
        status: 'success',
        origin,
      });

      return result;
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const durationMs = seconds * 1000 + nanoseconds / 1000000;

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
  async shutdown(): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      await this.client.shutdown();
    } catch {
      //swallow
    }
  }
}
