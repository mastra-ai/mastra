import { describe, expect, it } from 'vitest';
import { validateStartupConfiguration } from '../../src/config/startup.js';
import { readIntegrationConfig, readServerConfig } from '../../src/env.js';
import { LocalCloudEvidenceProvider } from '../../src/providers/cloud-evidence-provider.js';

describe('release startup', () => {
  it('requires only the default model credential for local Studio', () => {
    expect(() => validateStartupConfiguration({ OPENAI_API_KEY: 'unit-test-model-key' })).not.toThrow();
    expect(() => validateStartupConfiguration({})).toThrow(/OPENAI_API_KEY is required/u);
  });

  it.each(['staging', 'production'])('starts %s with no optional providers', mode => {
    const environment = {
      RUNTIME_MODE: mode,
      OPENAI_API_KEY: 'unit-test-model-key',
      APPROVAL_RESUME_SECRET: 'r'.repeat(32),
    };
    expect(() => validateStartupConfiguration(environment)).not.toThrow();
  });

  it('names invalid fields without disclosing their contents', () => {
    const value = 'private-setting-value';
    try {
      readServerConfig({ RUNTIME_MODE: value });
      expect.fail('Expected configuration failure');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(String(error)).toContain('RUNTIME_MODE');
      expect(String(error)).not.toContain(value);
    }
  });

  it('accepts Linear without custom labels or workflow states', () => {
    const config = readIntegrationConfig({
      RUNTIME_MODE: 'production',
      LINEAR_PROVIDER_ENABLED: 'true',
      LINEAR_API_KEY: 'unit-test-linear-key',
      LINEAR_WORKSPACE_ID: 'workspace_1',
      LINEAR_TEAM_ID: 'team_1',
      LINEAR_INTERNAL_BASE_URL: 'https://security.example.test/dashboard',
    });
    expect(config.linear.enabled).toBe(true);
    expect(config.linear.severityLabelIds).toBeUndefined();
    expect(config.linear.statusStateIds).toBeUndefined();
  });

  it('creates a Linear ticket without label/state IDs and keeps destination verification', async () => {
    const { LinearIncidentProvider } = await import('../../src/providers/linear-incident-provider.js');
    let title = '';
    const provider = new LinearIncidentProvider({
      workspaceId: 'workspace_1',
      teamId: 'team_1',
      severityLabelIds: {},
      statusStateIds: {},
      internalBaseUrl: 'https://security.example.test/dashboard',
      resolveDestination: async () => ({
        workspaceId: 'workspace_1',
        teamId: 'team_1',
      }),
      client: {
        searchIssues: async () => ({ nodes: [] }),
        createIssue: async input => {
          expect(input).toMatchObject({ priority: 2, teamId: 'team_1' });
          expect(input).not.toHaveProperty('labelIds');
          expect(input).not.toHaveProperty('stateId');
          expect(input.description).toContain('Status: awaiting_approval');
          title = input.title;
          return { success: true, issueId: 'issue_1' };
        },
        updateIssue: async () => {
          throw new Error('Unexpected update');
        },
        issue: async () => ({ id: 'issue_1', title, team: { id: 'team_1' } }),
      },
    });
    await expect(
      provider.create({
        idempotencyKey: 'delivery_1',
        generation: 1,
        projection: {
          incidentId: 'incident_1',
          tenantId: 'tenant_1',
          kind: 'unknown_device_login',
          severity: 'high',
          status: 'awaiting_approval',
          occurredAt: '2026-09-05T00:00:00.000Z',
          summaryCode: 'UNKNOWN_DEVICE_REQUIRES_REVIEW',
          planHashVersion: 1,
          planHash: 'a'.repeat(64),
          actionTypes: ['revoke_session'],
        },
      }),
    ).resolves.toEqual({ externalRef: 'linear:issue_1' });
  });

  it('does not invent hosted country or session history from missing credentials', async () => {
    const provider = new LocalCloudEvidenceProvider({
      countryByIp: {},
      includeIpPresence: false,
      includeSessionHistory: false,
    });
    const result = await provider.inspect(
      {
        tenantId: 'tenant_1',
        incidentId: 'incident_1',
        subjectId: 'subject_1',
        workflowRunId: 'run_1',
        incidentKind: 'disallowed_country_login',
        occurredAt: '2026-09-05T00:00:00.000Z',
        ip: '8.8.8.8',
      },
      { signal: new AbortController().signal, attempt: 1 },
    );
    expect(result).toMatchObject({
      facts: [expect.objectContaining({ factType: 'policy.allowedCountry' })],
    });
  });
});

describe('development port ownership', () => {
  it('rejects a port already owned by another listener', async () => {
    const { createServer } = await import('node:net');
    const { assertDevelopmentPortAvailable } = await import('../../src/dev-supervisor.js');
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing listener address');
      await expect(assertDevelopmentPortAvailable(address.port)).rejects.toThrow(/set PORT to a free port/u);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
    }
  });
});
