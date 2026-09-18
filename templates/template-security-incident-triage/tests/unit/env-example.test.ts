import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

import { describe, expect, it } from 'vitest';

import { readServerConfig, readApprovalConfig, readDashboardConfig } from '../../src/env.js';
import { validateStartupConfiguration } from '../../src/config/startup.js';
import { readStorageConfig } from '../../src/db/config.js';
import { readIntegrationConfig } from '../../src/config/integrations.js';

describe('local environment example', () => {
  it('starts with webhooks disabled and no external-provider opt-in', async () => {
    const example = await readFile('.env.example', 'utf8');
    const environment = parseEnv(example);
    expect(environment.OPENAI_API_KEY).toBe('');
    expect(() =>
      validateStartupConfiguration({
        ...environment,
        OPENAI_API_KEY: 'test-model-key',
      }),
    ).not.toThrow();
    expect(readStorageConfig(environment).url).toMatch(/\/incident\.db$/u);
    expect(readServerConfig(environment)).toMatchObject({
      mode: 'local',
      webhooksEnabled: false,
    });
    expect(readIntegrationConfig(environment)).toMatchObject({
      workos: { enabled: false },
      ipinfo: { enabled: false },
      linear: { enabled: false },
      deviceTrust: { enabled: false },
    });
    expect(readDashboardConfig(environment).enabled).toBe(false);
    expect(readApprovalConfig(environment).localApprovalsEnabled).toBe(false);
  });
});

describe('optional secrets', () => {
  it('derives stable, purpose-bound local approval keys from the dashboard secret', () => {
    const environment = {
      RUNTIME_MODE: 'local',
      DASHBOARD_CSRF_SECRET: 'd'.repeat(32),
    };
    const first = readApprovalConfig(environment);
    const second = readApprovalConfig(environment);
    expect(first.approvalResumeSecret).toHaveLength(64);
    expect(first.localApprovalSecret).toHaveLength(64);
    expect(first.approvalResumeSecret).toBe(second.approvalResumeSecret);
    expect(first.localApprovalSecret).not.toBe(first.approvalResumeSecret);
    expect(() =>
      readApprovalConfig({
        ...environment,
        RUNTIME_MODE: 'production',
      }),
    ).toThrow('APPROVAL_RESUME_SECRET is required outside local mode.');
  });

  it('normalizes only empty secrets while integrations are disabled', () => {
    expect(
      readServerConfig({
        WEBHOOKS_ENABLED: 'false',
        ALERT_WEBHOOK_SECRET: '',
      }).alertWebhookSecret,
    ).toBeUndefined();
    expect(
      readApprovalConfig({
        LOCAL_APPROVALS_ENABLED: 'false',
        LOCAL_APPROVAL_SECRET: '',
      }).localApprovalSecret,
    ).toBeUndefined();
    expect(
      readDashboardConfig({
        DASHBOARD_AUTH_ENABLED: 'false',
        WORKOS_API_KEY: '',
      }).workosApiKey,
    ).toBeUndefined();
    expect(
      readIntegrationConfig({
        WORKOS_PROVIDER_ENABLED: 'false',
        WORKOS_API_KEY: '',
      }).workos.apiKey,
    ).toBeUndefined();
  });

  it('rejects whitespace-padded secret material at every configuration boundary', () => {
    expect(() =>
      readServerConfig({
        ALERT_WEBHOOK_SECRET: ` ${'a'.repeat(16)}`,
        WORKOS_WEBHOOK_SECRET: 'b'.repeat(16),
      }),
    ).toThrow('Invalid server configuration.');
    expect(() =>
      readApprovalConfig({
        LOCAL_APPROVALS_ENABLED: 'false',
        LOCAL_APPROVAL_SECRET: `${'a'.repeat(32)} `,
      }),
    ).toThrow('Invalid approval configuration.');
    expect(() =>
      readDashboardConfig({
        DASHBOARD_AUTH_ENABLED: 'false',
        DASHBOARD_CSRF_SECRET: ` ${'a'.repeat(32)}`,
      }),
    ).toThrow('Invalid dashboard configuration.');
    expect(() =>
      readIntegrationConfig({
        WORKOS_PROVIDER_ENABLED: 'false',
        WORKOS_API_KEY: `${'a'.repeat(16)} `,
      }),
    ).toThrow('Invalid integration configuration.');
    expect(() =>
      readIntegrationConfig({
        IPINFO_PROVIDER_ENABLED: 'false',
        GEOIP_CACHE_HMAC_KEY: ' base64:AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
      }),
    ).toThrow('Invalid integration configuration.');
  });

  it('fails early for short or missing secrets when a boundary is enabled', () => {
    expect(() =>
      readServerConfig({
        WEBHOOKS_ENABLED: 'true',
        ALERT_WEBHOOK_SECRET: 'short',
        WORKOS_WEBHOOK_SECRET: 'x'.repeat(16),
      }),
    ).toThrow();
    expect(() =>
      readServerConfig({
        WEBHOOKS_ENABLED: 'true',
        ALERT_WEBHOOK_SECRET: ' ',
        WORKOS_WEBHOOK_SECRET: ' '.repeat(16),
      }),
    ).toThrow();
    expect(() =>
      readDashboardConfig({
        DASHBOARD_AUTH_ENABLED: 'true',
        WORKOS_API_KEY: ' ',
        WORKOS_CLIENT_ID: 'x'.repeat(8),
        WORKOS_REDIRECT_URI: 'https://example.test',
        WORKOS_COOKIE_PASSWORD: 'x'.repeat(32),
        DASHBOARD_CSRF_SECRET: 'x'.repeat(32),
      }),
    ).toThrow();
    expect(() =>
      readDashboardConfig({
        DASHBOARD_AUTH_ENABLED: 'true',
        WORKOS_API_KEY: 'x'.repeat(16),
        WORKOS_CLIENT_ID: 'x'.repeat(8),
        WORKOS_REDIRECT_URI: 'https://example.test/auth/callback',
        WORKOS_COOKIE_PASSWORD: 'x'.repeat(32),
      }),
    ).toThrow('WorkOS dashboard authentication is incomplete. Missing: DASHBOARD_CSRF_SECRET.');
    expect(() =>
      readIntegrationConfig({
        RUNTIME_MODE: 'staging',
        WEBHOOKS_ENABLED: 'true',
        WORKOS_PROVIDER_ENABLED: 'true',
        WORKOS_API_KEY: 'short',
        WORKOS_WEBHOOK_SECRET: 'x'.repeat(16),
        WORKOS_ORGANIZATION_ID: 'org_123',
        WORKOS_ALLOWED_USER_IDS: 'user_123',
        WORKOS_ALLOWED_ROLE_SLUGS: 'responder',
      }),
    ).toThrow();
  });
});
