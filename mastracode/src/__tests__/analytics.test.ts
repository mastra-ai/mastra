import { describe, expect, it } from 'vitest';

import { createMastraCodeAnalytics, isTelemetryDisabled } from '../analytics.js';

describe('analytics telemetry disable', () => {
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
});
