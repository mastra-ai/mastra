import { describe, expect, it } from 'vitest';

import { readServerConfig } from '../../src/env.js';

describe('alert intake configuration', () => {
  it('defaults to local mode with signed intake disabled', () => {
    expect(readServerConfig({})).toMatchObject({
      mode: 'local',
      webhooksEnabled: false,
    });
    expect(() => readServerConfig({ WEBHOOKS_ENABLED: 'true' })).toThrow(/ALERT_WEBHOOK_SECRET.*required/u);
  });

  it('validates bounded local defaults and source allowlist', () => {
    const config = readServerConfig({
      PATH: '/usr/bin',
      ALERT_WEBHOOK_SECRET: 'a'.repeat(16),
      WORKOS_WEBHOOK_SECRET: 'b'.repeat(16),
      ALERT_WEBHOOK_SOURCES: 'demo,second-source, INVALID SOURCE ',
    });
    expect(config).toMatchObject({
      mode: 'local',
      webhookMaxBodyBytes: 65_536,
      mastraMaxBodyBytes: 1_048_576,
      outbox: { batchSize: 16, maxAttempts: 5 },
    });
    expect([...config.alertWebhookSources]).toEqual(['demo', 'second-source']);
  });

  it('accepts staging without enabling providers and rejects unbounded values', () => {
    const base = {
      ALERT_WEBHOOK_SECRET: 'a'.repeat(16),
      WORKOS_WEBHOOK_SECRET: 'b'.repeat(16),
    };
    expect(readServerConfig({ ...base, RUNTIME_MODE: 'staging' }).mode).toBe('staging');
    expect(() => readServerConfig({ ...base, WEBHOOK_MAX_BODY_BYTES: '999999' })).toThrow(/Invalid/u);
  });
});
