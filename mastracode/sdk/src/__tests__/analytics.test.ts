import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMastraCodeAnalytics, getMastraAnalyticsDistinctId, isTelemetryDisabled } from '../analytics.js';

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.MASTRACODE_ANALYTICS_DEBUG;
});

describe('analytics telemetry disable', () => {
  it('generates and persists a random distinct id', () => {
    withTempAnalyticsConfig(configPath => {
      const distinctId = getMastraAnalyticsDistinctId(configPath);

      expect(distinctId).toMatch(/^mastra-[0-9a-f-]{36}$/);
      expect(JSON.parse(readFileSync(configPath, 'utf-8'))).toEqual({ distinctId });
      expect(getMastraAnalyticsDistinctId(configPath)).toBe(distinctId);
    });
  });

  it('migrates hostname-derived distinct ids without aliasing collided users', () => {
    withTempAnalyticsConfig(configPath => {
      const oldDistinctId = `mastra-${hostname()}`;
      writeFileSync(configPath, JSON.stringify({ distinctId: oldDistinctId }));

      const distinctId = getMastraAnalyticsDistinctId(configPath);

      expect(distinctId).toMatch(/^mastra-[0-9a-f-]{36}$/);
      expect(distinctId).not.toBe(oldDistinctId);
      expect(JSON.parse(readFileSync(configPath, 'utf-8'))).toEqual({ distinctId });
    });
  });

  it('regenerates when analytics config is invalid', () => {
    withTempAnalyticsConfig(configPath => {
      writeFileSync(configPath, '{invalid');

      const distinctId = getMastraAnalyticsDistinctId(configPath);

      expect(distinctId).toMatch(/^mastra-[0-9a-f-]{36}$/);
      expect(JSON.parse(readFileSync(configPath, 'utf-8'))).toEqual({ distinctId });
    });
  });

  it('regenerates when analytics config has a malformed distinct id', () => {
    withTempAnalyticsConfig(configPath => {
      writeFileSync(configPath, JSON.stringify({ distinctId: 'mastra-local' }));

      const distinctId = getMastraAnalyticsDistinctId(configPath);

      expect(distinctId).toMatch(/^mastra-[0-9a-f-]{36}$/);
      expect(distinctId).not.toBe('mastra-local');
      expect(JSON.parse(readFileSync(configPath, 'utf-8'))).toEqual({ distinctId });
    });
  });

  it('treats common truthy env values as disabled', () => {
    expect(isTelemetryDisabled({ MASTRA_TELEMETRY_DISABLED: '1' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isTelemetryDisabled({ MASTRA_TELEMETRY_DISABLED: 'true' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isTelemetryDisabled({ MASTRA_TELEMETRY_DISABLED: 'YES' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isTelemetryDisabled({ MASTRA_TELEMETRY_DISABLED: 'on' } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('leaves telemetry enabled for unset or falsy env values', () => {
    expect(isTelemetryDisabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isTelemetryDisabled({ MASTRA_TELEMETRY_DISABLED: '0' } as NodeJS.ProcessEnv)).toBe(false);
    expect(isTelemetryDisabled({ MASTRA_TELEMETRY_DISABLED: 'false' } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('returns a noop analytics client when telemetry is disabled', async () => {
    const original = process.env.MASTRA_TELEMETRY_DISABLED;
    process.env.MASTRA_TELEMETRY_DISABLED = '1';

    try {
      const analytics = createMastraCodeAnalytics({ version: 'test-version' });

      expect(analytics.isEnabled()).toBe(false);
      expect(() => analytics.capture('mastracode_session_started')).not.toThrow();
      expect(() => analytics.trackCommand('models')).not.toThrow();
      expect(() => analytics.trackInteractivePrompt('ask_user')).not.toThrow();
      await expect(analytics.shutdown()).resolves.toBeUndefined();
    } finally {
      if (original === undefined) {
        delete process.env.MASTRA_TELEMETRY_DISABLED;
      } else {
        process.env.MASTRA_TELEMETRY_DISABLED = original;
      }
    }
  });

  it('writes debug logs for disabled analytics when requested', () => {
    const original = process.env.MASTRA_TELEMETRY_DISABLED;
    process.env.MASTRA_TELEMETRY_DISABLED = '1';
    process.env.MASTRACODE_ANALYTICS_DEBUG = '1';
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    try {
      const analytics = createMastraCodeAnalytics({ version: 'test-version' });
      analytics.capture('mastracode_session_started');

      expect(stderr).toHaveBeenCalledWith(expect.stringContaining('disabled by MASTRA_TELEMETRY_DISABLED'));
      expect(stderr).toHaveBeenCalledWith(expect.stringContaining('capture skipped: telemetry disabled'));
    } finally {
      if (original === undefined) {
        delete process.env.MASTRA_TELEMETRY_DISABLED;
      } else {
        process.env.MASTRA_TELEMETRY_DISABLED = original;
      }
    }
  });
});

function withTempAnalyticsConfig(run: (configPath: string) => void): void {
  const dir = mkdtempSync(path.join(tmpdir(), 'mastracode-analytics-'));
  const configPath = path.join(dir, 'analytics.json');
  try {
    run(configPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
