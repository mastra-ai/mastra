import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { capture, flush, PostHog } = vi.hoisted(() => {
  const capture = vi.fn();
  const flush = vi.fn().mockResolvedValue(undefined);
  const PostHog = vi.fn(function () {
    return { capture, flush };
  });
  return { capture, flush, PostHog };
});

vi.mock('posthog-node', () => ({ PostHog }));

import { captureEEEvent, resetEETelemetryForTests } from './posthog';

describe('EE PostHog telemetry', () => {
  let originalTelemetryDisabled: string | undefined;

  beforeEach(() => {
    originalTelemetryDisabled = process.env['MASTRA_TELEMETRY_DISABLED'];
    delete process.env['MASTRA_TELEMETRY_DISABLED'];
    capture.mockClear();
    flush.mockClear();
    PostHog.mockClear();
    resetEETelemetryForTests();
  });

  afterEach(() => {
    if (originalTelemetryDisabled !== undefined) process.env['MASTRA_TELEMETRY_DISABLED'] = originalTelemetryDisabled;
    else delete process.env['MASTRA_TELEMETRY_DISABLED'];
    resetEETelemetryForTests();
  });

  it.each(['1', 'true', 'TRUE', 'yes', ' True '])('suppresses events when MASTRA_TELEMETRY_DISABLED=%s', value => {
    process.env['MASTRA_TELEMETRY_DISABLED'] = value;

    captureEEEvent('ee_license_check', 'user-1', { license_hash: 'safe' });

    expect(PostHog).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it.each(['0', 'false', 'no', 'off', 'on'])('still sends events when MASTRA_TELEMETRY_DISABLED=%s', value => {
    process.env['MASTRA_TELEMETRY_DISABLED'] = value;

    captureEEEvent('ee_license_check', 'user-1', { license_hash: 'safe' });

    expect(PostHog).toHaveBeenCalled();
    expect(capture).toHaveBeenCalled();
  });

  it('includes a hashed machine id for install-level differentiation', () => {
    captureEEEvent('ee_license_check', undefined, { license_hash: 'safe' });

    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: expect.stringMatching(/^mastra-[a-f0-9]{16}$/),
        properties: expect.objectContaining({
          machine_id: expect.stringMatching(/^[a-f0-9]{16}$/),
        }),
      }),
    );
  });

  it('swallows PostHog capture failures', () => {
    capture.mockImplementationOnce(() => {
      throw new Error('posthog unavailable');
    });

    expect(() => captureEEEvent('ee_feature_used', 'user-1', { feature: 'fga' })).not.toThrow();
  });
});
