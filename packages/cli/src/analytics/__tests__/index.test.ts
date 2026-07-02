import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../commands/utils.js', () => ({
  getPackageManager: () => 'pnpm',
}));

vi.mock('posthog-node', () => ({
  PostHog: vi.fn().mockImplementation(function () {
    return {
      capture: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
  }),
}));

import { PostHog } from 'posthog-node';
import { PosthogAnalytics } from '../index.js';

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.MASTRA_TELEMETRY_DISABLED;
});

describe('PosthogAnalytics distinct ids', () => {
  it('generates and persists random distinct and session ids', () => {
    withTempAnalyticsConfig(configPath => {
      const analytics = new PosthogAnalytics({
        version: 'test-version',
        apiKey: 'test-key',
        host: 'https://posthog.test',
      });
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));

      expect(config.distinctId).toMatch(/^mastra-[0-9a-f-]{36}$/);
      expect(config.sessionId).toMatch(/^[0-9a-f-]{36}$/);
      expect((analytics as unknown as { distinctId: string }).distinctId).toBe(config.distinctId);
      expect((analytics as unknown as { sessionId: string }).sessionId).toBe(config.sessionId);

      const nextAnalytics = new PosthogAnalytics({
        version: 'test-version',
        apiKey: 'test-key',
        host: 'https://posthog.test',
      });
      expect((nextAnalytics as unknown as { distinctId: string }).distinctId).toBe(config.distinctId);
      expect((nextAnalytics as unknown as { sessionId: string }).sessionId).toBe(config.sessionId);
    });
  });

  it('migrates hostname-derived distinct ids without aliasing collided users', () => {
    withTempAnalyticsConfig(configPath => {
      const oldDistinctId = `mastra-${os.hostname()}`;
      writeFileSync(configPath, JSON.stringify({ distinctId: oldDistinctId, sessionId: 'old-session-id' }));

      const analytics = new PosthogAnalytics({
        version: 'test-version',
        apiKey: 'test-key',
        host: 'https://posthog.test',
      });
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));

      expect((analytics as unknown as { distinctId: string }).distinctId).toMatch(/^mastra-[0-9a-f-]{36}$/);
      expect((analytics as unknown as { distinctId: string }).distinctId).not.toBe(oldDistinctId);
      expect(config.distinctId).toBe((analytics as unknown as { distinctId: string }).distinctId);
      expect(config.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  it('preserves a valid distinct id when repairing a missing session id', () => {
    withTempAnalyticsConfig(configPath => {
      const distinctId = 'mastra-00000000-0000-0000-0000-000000000000';
      writeFileSync(configPath, JSON.stringify({ distinctId }));

      const analytics = new PosthogAnalytics({
        version: 'test-version',
        apiKey: 'test-key',
        host: 'https://posthog.test',
      });
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));

      expect((analytics as unknown as { distinctId: string }).distinctId).toBe(distinctId);
      expect(config.distinctId).toBe(distinctId);
      expect(config.sessionId).toMatch(/^[0-9a-f-]{36}$/);
      expect((analytics as unknown as { sessionId: string }).sessionId).toBe(config.sessionId);
    });
  });
});

describe('PosthogAnalytics command tracking', () => {
  it('includes zero duration command events', () => {
    withTempAnalyticsConfig(() => {
      const analytics = new PosthogAnalytics({
        version: 'test-version',
        apiKey: 'test-key',
        host: 'https://posthog.test',
      });
      const client = vi.mocked(PostHog).mock.results.at(-1)?.value as { capture: ReturnType<typeof vi.fn> };

      analytics.trackCommand({
        command: 'test-command',
        durationMs: 0,
      });

      expect(client.capture).toHaveBeenLastCalledWith(
        expect.objectContaining({
          event: 'cli_command',
          properties: expect.objectContaining({
            command: 'test-command',
            durationMs: 0,
          }),
        }),
      );
    });
  });
});

function withTempAnalyticsConfig(run: (configPath: string) => void): void {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'mastra-cli-analytics-'));
  const configPath = path.join(dir, 'analytics.json');
  const getOrCreateAnalyticsConfig = Object.getOwnPropertyDescriptor(
    PosthogAnalytics.prototype,
    'getOrCreateAnalyticsConfig',
  );

  vi.spyOn(
    PosthogAnalytics.prototype as unknown as { getOrCreateAnalyticsConfig: (configPath?: string) => unknown },
    'getOrCreateAnalyticsConfig',
  ).mockImplementation(function (this: { getOrCreateAnalyticsConfig: (configPath?: string) => unknown }) {
    return getOrCreateAnalyticsConfig?.value.call(this, configPath);
  });

  try {
    run(configPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
