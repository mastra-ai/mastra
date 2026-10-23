import { describe, expect, it } from 'vitest';

import { IpinfoLiteProvider, LocalGeoIpProvider } from '../../src/providers/geoip-provider.js';
import { AmbiguousLinearUpdateError, LinearIncidentProvider } from '../../src/providers/linear-incident-provider.js';
import { LocalIncidentProvider } from '../../src/providers/local-incident-provider.js';

const projection = {
  incidentId: 'incident_1',
  tenantId: 'tenant_1',
  kind: 'unknown_device_login' as const,
  severity: 'high' as const,
  status: 'awaiting_approval' as const,
  occurredAt: '2026-08-29T00:00:00.000Z',
  summaryCode: 'UNKNOWN_DEVICE_REQUIRES_REVIEW' as const,
  planHashVersion: 1 as const,
  planHash: 'a'.repeat(64),
  actionTypes: ['revoke_session' as const],
};

describe('integration shared provider failure matrix', () => {
  it.each([
    ['mock', () => new LocalGeoIpProvider()],
    [
      'real-via-fake',
      () =>
        new IpinfoLiteProvider({
          token: 'fake',
          timeoutMs: 20,
          transport: async () => ({ status: 503, json: async () => ({}) }),
        }),
    ],
  ] as const)('GeoIP %s remains closed for unavailable evidence', async (_name, create) => {
    const result = await create().lookup({
      ip: '8.8.8.8',
      deadline: new Date(Date.now() + 100),
    });
    expect(result.outcome).toBe('unknown');
  });

  it.each([
    ['mock', () => new LocalIncidentProvider()],
    ['real-via-fake', () => linearFake()],
  ] as const)('Incident %s has a stable idempotent create boundary', async (_name, create) => {
    const provider = create();
    const first = await provider.create({
      projection,
      idempotencyKey: 'matrix',
      generation: 1,
    });
    await expect(
      provider.create({
        projection,
        idempotencyKey: 'matrix',
        generation: 1,
      }),
    ).resolves.toEqual(first);
  });
});

function linearFake(): LinearIncidentProvider {
  let title = '';
  return new LinearIncidentProvider({
    client: {
      createIssue: async input => {
        title = input.title;
        return { success: true, issueId: 'matrix_issue' };
      },
      updateIssue: async () => ({ success: false }),
      searchIssues: async () => ({ nodes: [] }),
      issue: async id => ({
        id,
        title,
        state: { id: 'state_1' },
        team: { id: 'team_1' },
      }),
    },
    workspaceId: 'workspace_1',
    teamId: 'team_1',
    severityLabelIds: { low: 'l', medium: 'm', high: 'h', critical: 'c' },
    statusStateIds: { awaiting_approval: 'state_1' },
    internalBaseUrl: 'https://linear.example/base',
    resolveDestination: async () => ({
      workspaceId: 'workspace_1',
      teamId: 'team_1',
    }),
  });
}

describe('GeoIPProvider shared contract', () => {
  it('keeps unknown/failure results closed and real-via-fake caches known evidence', async () => {
    const mock = new LocalGeoIpProvider();
    await expect(mock.lookup({ ip: '8.8.8.8', deadline: new Date(Date.now() + 100) })).resolves.toEqual({
      outcome: 'unknown',
      reasonCode: 'disabled',
    });
    let calls = 0;
    const provider = new IpinfoLiteProvider({
      token: 'fake',
      timeoutMs: 20,
      transport: async () => ({
        status: 200,
        json: async () => {
          calls += 1;
          return { country_code: 'BR' };
        },
      }),
    });
    const input = { ip: '8.8.8.8', deadline: new Date(Date.now() + 100) };
    await expect(provider.lookup(input)).resolves.toMatchObject({
      outcome: 'known',
      countryCode: 'BR',
    });
    await provider.lookup(input);
    expect(calls).toBe(1);
    await expect(provider.lookup({ ip: '127.0.0.1', deadline: input.deadline })).resolves.toEqual({
      outcome: 'unknown',
      reasonCode: 'private',
    });
  });

  it('does not cache cancelled, throttled, unavailable, or malformed responses', async () => {
    const deadline = new Date(Date.now() + 1_000);
    const controller = new AbortController();
    controller.abort();
    const provider = new IpinfoLiteProvider({
      token: 'fake',
      timeoutMs: 20,
      transport: async () => ({ status: 429, json: async () => ({}) }),
    });
    await expect(provider.lookup({ ip: '1.1.1.1', deadline, signal: controller.signal })).resolves.toEqual({
      outcome: 'unknown',
      reasonCode: 'timeout',
    });
    await expect(provider.lookup({ ip: '1.1.1.1', deadline })).resolves.toEqual({
      outcome: 'unknown',
      reasonCode: 'rate_limited',
    });
    const unavailable = new IpinfoLiteProvider({
      token: 'fake',
      timeoutMs: 20,
      transport: async () => ({ status: 503, json: async () => ({}) }),
    });
    await expect(unavailable.lookup({ ip: '1.1.1.1', deadline })).resolves.toEqual({
      outcome: 'unknown',
      reasonCode: 'unavailable',
    });
    let malformedCalls = 0;
    const malformed = new IpinfoLiteProvider({
      token: 'fake',
      timeoutMs: 20,
      transport: async () => {
        malformedCalls += 1;
        return { status: 200, json: async () => ({ country_code: 'bad' }) };
      },
    });
    await malformed.lookup({ ip: '1.1.1.1', deadline });
    await malformed.lookup({ ip: '1.1.1.1', deadline });
    expect(malformedCalls).toBe(2);
  });
});

const geoFailureMatrix = [
  {
    name: 'nominal',
    status: 200,
    body: { country_code: 'BR' },
    reason: undefined,
  },
  { name: 'rate-limit', status: 429, body: {}, reason: 'rate_limited' },
  { name: 'unavailable', status: 503, body: {}, reason: 'unavailable' },
  {
    name: 'invalid-partial',
    status: 200,
    body: { country_code: 'bad' },
    reason: 'invalid_response',
  },
] as const;

for (const [name, create] of [
  [
    'mock',
    (row: (typeof geoFailureMatrix)[number]) =>
      new LocalGeoIpProvider(
        new Map([
          [
            '8.8.8.8',
            row.reason
              ? { outcome: 'unknown' as const, reasonCode: row.reason }
              : {
                  outcome: 'known' as const,
                  countryCode: 'BR',
                  observedAt: '2026-08-29T00:00:00.000Z',
                  provider: 'ipinfo-lite' as const,
                  confidence: 0.7 as const,
                  confidenceProvenance: 'policy-v1' as const,
                },
          ],
        ]),
      ),
  ],
  [
    'real-via-fake',
    (row: (typeof geoFailureMatrix)[number]) =>
      new IpinfoLiteProvider({
        token: 'fake',
        timeoutMs: 20,
        transport: async () => ({
          status: row.status,
          json: async () => row.body,
        }),
      }),
  ],
] as const) {
  describe(`GeoIP shared factory matrix: ${name}`, () => {
    it.each(geoFailureMatrix)('keeps $name evidence closed consistently', async row => {
      const result = await create(row).lookup({
        tenantId: 'tenant_1',
        ip: '8.8.8.8',
        deadline: new Date(Date.now() + 100),
      });
      if (row.reason)
        expect(result).toEqual({
          outcome: 'unknown',
          reasonCode: row.reason,
        });
      else expect(result).toMatchObject({ outcome: 'known', countryCode: 'BR' });
    });

    it('treats cancellation/deadline as timeout without crossing a tenant boundary', async () => {
      const controller = new AbortController();
      controller.abort();
      await expect(
        create(geoFailureMatrix[0]).lookup({
          tenantId: 'tenant_2',
          ip: '8.8.8.8',
          deadline: new Date(Date.now() + 100),
          signal: controller.signal,
        }),
      ).resolves.toEqual({ outcome: 'unknown', reasonCode: 'timeout' });
    });
  });
}

describe('IncidentProvider shared contract', () => {
  it('retries destination resolution after a transient failure and writes once after validation', async () => {
    let resolutionAttempts = 0;
    let creates = 0;
    let title = '';
    const linear = new LinearIncidentProvider({
      client: {
        createIssue: async input => {
          creates += 1;
          title = input.title;
          return { success: true, issueId: 'issue_destination_retry' };
        },
        updateIssue: async () => ({ success: false }),
        searchIssues: async () => ({ nodes: [] }),
        issue: async id => ({
          id,
          title,
          state: { id: 'state_1' },
          team: { id: 'team_1' },
        }),
      },
      workspaceId: 'workspace_1',
      teamId: 'team_1',
      severityLabelIds: { low: 'l', medium: 'm', high: 'h', critical: 'c' },
      statusStateIds: { awaiting_approval: 'state_1' },
      internalBaseUrl: 'https://linear.example/base',
      resolveDestination: async () => {
        resolutionAttempts += 1;
        if (resolutionAttempts === 1) throw new Error('transient destination read');
        return { workspaceId: 'workspace_1', teamId: 'team_1' };
      },
    });
    await expect(
      linear.create({
        projection,
        idempotencyKey: 'destination-retry',
        generation: 1,
      }),
    ).rejects.toThrow('transient destination read');
    await expect(
      linear.create({
        projection,
        idempotencyKey: 'destination-retry',
        generation: 1,
      }),
    ).resolves.toEqual({ externalRef: 'linear:issue_destination_retry' });
    expect(resolutionAttempts).toBe(2);
    expect(creates).toBe(1);
  });

  it('supports idempotent mock and SDK-shaped Linear fake create/update/reconcile', async () => {
    const mock = new LocalIncidentProvider();
    const first = await mock.create({
      projection,
      idempotencyKey: 'delivery_1',
      generation: 1,
    });
    await expect(mock.create({ projection, idempotencyKey: 'delivery_1', generation: 1 })).resolves.toEqual(first);
    let title = '';
    const linear = new LinearIncidentProvider({
      client: {
        createIssue: async input => {
          title = input.title;
          return { success: true, issueId: 'issue_1' };
        },
        updateIssue: async (_id, input) => {
          title = input.title;
          return { success: true, issueId: 'issue_1' };
        },
        searchIssues: async () => ({ nodes: [] }),
        issue: async id => ({
          id,
          title,
          state: { id: 'state_1' },
          team: { id: 'team_1' },
        }),
      },
      workspaceId: 'workspace_1',
      teamId: 'team_1',
      severityLabelIds: { low: 'l', medium: 'm', high: 'h', critical: 'c' },
      statusStateIds: { awaiting_approval: 'state_1' },
      internalBaseUrl: 'https://linear.example/base',
      resolveDestination: async () => ({
        workspaceId: 'workspace_1',
        teamId: 'team_1',
      }),
    });
    await expect(
      linear.create({
        projection,
        idempotencyKey: 'delivery_2',
        generation: 1,
      }),
    ).resolves.toEqual({ externalRef: 'linear:issue_1' });
    await linear.update({
      externalRef: 'linear:issue_1',
      projection,
      idempotencyKey: 'delivery_2',
      generation: 2,
    });
    await expect(
      linear.reconcile({
        operation: 'update',
        externalRef: 'linear:issue_1',
        idempotencyKey: 'delivery_2',
        generation: 2,
        projection,
      }),
    ).resolves.toEqual({ externalRef: 'linear:issue_1' });
    expect(title).not.toContain('tenant_1');
  });

  it('rejects stale update readback and reconciles generic post-update errors without repeating it', async () => {
    let updates = 0;
    let title = '';
    let stateId = 'wrong-state';
    const linear = new LinearIncidentProvider({
      client: {
        createIssue: async () => ({ success: true, issueId: 'issue_1' }),
        updateIssue: async (_id, input) => {
          updates += 1;
          title = input.title;
          throw new Error('response lost after apply');
        },
        searchIssues: async () => ({ nodes: [] }),
        issue: async id => ({
          id,
          title,
          state: { id: stateId },
          team: { id: 'team_1' },
        }),
      },
      workspaceId: 'workspace_1',
      teamId: 'team_1',
      severityLabelIds: { low: 'l', medium: 'm', high: 'h', critical: 'c' },
      statusStateIds: { awaiting_approval: 'state_1' },
      internalBaseUrl: 'https://linear.example/base',
      resolveDestination: async () => ({
        workspaceId: 'workspace_1',
        teamId: 'team_1',
      }),
    });
    await expect(
      linear.update({
        externalRef: 'linear:issue_1',
        projection,
        idempotencyKey: 'delivery_3',
        generation: 3,
      }),
    ).rejects.toBeInstanceOf(AmbiguousLinearUpdateError);
    expect(updates).toBe(1);
    stateId = 'state_1';
    await expect(
      linear.reconcile({
        operation: 'update',
        externalRef: 'linear:issue_1',
        projection,
        idempotencyKey: 'delivery_3',
        generation: 3,
      }),
    ).resolves.toEqual({ externalRef: 'linear:issue_1' });
    expect(updates).toBe(1);
  });

  it('does not accept a nominal update response until full readback matches', async () => {
    let reads = 0;
    const linear = new LinearIncidentProvider({
      client: {
        createIssue: async () => ({ success: true, issueId: 'issue_1' }),
        updateIssue: async () => ({ success: true, issueId: 'issue_1' }),
        searchIssues: async () => ({ nodes: [] }),
        issue: async id => {
          reads += 1;
          return {
            id,
            title: 'delivery-marker-but-wrong-generation',
            state: { id: 'wrong-state' },
            team: { id: 'wrong-team' },
          };
        },
      },
      workspaceId: 'workspace_1',
      teamId: 'team_1',
      severityLabelIds: { low: 'l', medium: 'm', high: 'h', critical: 'c' },
      statusStateIds: { awaiting_approval: 'state_1' },
      internalBaseUrl: 'https://linear.example/base',
      resolveDestination: async () => ({
        workspaceId: 'workspace_1',
        teamId: 'team_1',
      }),
    });
    await expect(
      linear.update({
        externalRef: 'linear:issue_1',
        projection,
        idempotencyKey: 'delivery_4',
        generation: 4,
      }),
    ).rejects.toBeInstanceOf(AmbiguousLinearUpdateError);
    expect(reads).toBeGreaterThan(0);
  });
});

type IncidentScenario =
  | 'nominal'
  | 'idempotency-concurrency'
  | 'rate-limit'
  | 'unavailable'
  | 'invalid-partial'
  | 'target-fence-status-mismatch';
const incidentFailureMatrix: readonly IncidentScenario[] = [
  'nominal',
  'idempotency-concurrency',
  'rate-limit',
  'unavailable',
  'invalid-partial',
  'target-fence-status-mismatch',
];

function incidentMockFactory(scenario: IncidentScenario) {
  return new LocalIncidentProvider({
    failAttempts: scenario === 'rate-limit' || scenario === 'unavailable' || scenario === 'invalid-partial' ? 1 : 0,
  });
}

function incidentLinearFactory(scenario: IncidentScenario) {
  let title = '';
  let reads = 0;
  const fails = scenario === 'rate-limit' || scenario === 'unavailable' || scenario === 'invalid-partial';
  return new LinearIncidentProvider({
    client: {
      createIssue: async input => {
        title = input.title;
        if (fails) {
          if (scenario === 'invalid-partial') return { success: true };
          throw new Error(scenario);
        }
        return { success: true, issueId: 'matrix_issue' };
      },
      updateIssue: async () => ({ success: true, issueId: 'matrix_issue' }),
      searchIssues: async () => ({ nodes: [] }),
      issue: async id => ({
        id,
        title,
        state: {
          id: scenario === 'target-fence-status-mismatch' && ++reads > 1 ? 'wrong-state' : 'state_1',
        },
        team: { id: 'team_1' },
      }),
    },
    workspaceId: 'workspace_1',
    teamId: 'team_1',
    severityLabelIds: { low: 'l', medium: 'm', high: 'h', critical: 'c' },
    statusStateIds: { awaiting_approval: 'state_1' },
    internalBaseUrl: 'https://linear.example/base',
    resolveDestination: async () => ({
      workspaceId: 'workspace_1',
      teamId: 'team_1',
    }),
  });
}

for (const [name, create] of [
  ['mock', incidentMockFactory],
  ['real-via-fake', incidentLinearFactory],
] as const) {
  describe(`Incident/Linear shared factory matrix: ${name}`, () => {
    it.each(incidentFailureMatrix)('contains $case failures and effects', async scenario => {
      const provider = create(scenario);
      const input = {
        projection,
        idempotencyKey: `matrix-${scenario}`,
        generation: 1,
      };
      if (scenario === 'rate-limit' || scenario === 'unavailable' || scenario === 'invalid-partial') {
        await expect(provider.create(input)).rejects.toThrow();
        return;
      }
      if (scenario === 'target-fence-status-mismatch') {
        const created = await provider.create(input);
        await expect(
          provider.update({
            externalRef: name === 'mock' ? 'linear:wrong-target' : created.externalRef,
            projection,
            idempotencyKey: `matrix-${scenario}-update`,
            generation: 2,
          }),
        ).rejects.toThrow();
        return;
      }
      const first = await provider.create(input);
      await expect(provider.create(input)).resolves.toEqual(first);
    });
  });
}
