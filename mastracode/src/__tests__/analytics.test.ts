import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMastraCodeAnalytics, getMastraAnalyticsDistinctId, isTelemetryDisabled } from '../analytics.js';

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.MASTRACODE_ANALYTICS_DEBUG;
});

describe('analytics telemetry disable', () => {
  it('uses the same distinct id format as the Mastra CLI analytics', () => {
    expect(getMastraAnalyticsDistinctId('test-host')).toBe('mastra-test-host');
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
