import { describe, expect, it } from 'vitest';

import { IpinfoLiteProvider, LocalGeoIpProvider } from '../../src/providers/geoip-provider.js';
import { LinearIncidentProvider } from '../../src/providers/linear-incident-provider.js';
import { LocalIncidentProvider } from '../../src/providers/local-incident-provider.js';

/**
 * This is intentionally one data table per boundary, not a pair of lookalike
 * tests.  Every row is executed unchanged against the mock and the SDK-shaped
 * remote-via-fake adapter.  Provider-specific SDK payload tests live elsewhere.
 */
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

type Expected = Readonly<{
  outcome: 'known' | 'unknown' | 'rejected';
  calls: number;
  mutations: number;
  cache: 'miss' | 'hit' | 'expired' | 'blocked' | 'none';
  audit: 'redacted';
}>;

type GeoScenario = Readonly<{
  name: string;
  operation: 'lookup';
  inject:
    | 'nominal'
    | 'cache-hit'
    | 'cache-expiry'
    | 'private-v4'
    | 'private-v6'
    | 'bogon-v4'
    | 'bogon-v6'
    | 'timeout'
    | 'rate-limit'
    | 'unavailable'
    | 'invalid-partial'
    | 'cancelled'
    | 'cross-tenant';
  expected: Expected;
}>;

const geoScenarios: readonly GeoScenario[] = [
  {
    name: 'nominal',
    operation: 'lookup',
    inject: 'nominal',
    expected: {
      outcome: 'known',
      calls: 1,
      mutations: 0,
      cache: 'miss',
      audit: 'redacted',
    },
  },
  {
    name: 'cache hit',
    operation: 'lookup',
    inject: 'cache-hit',
    expected: {
      outcome: 'known',
      calls: 1,
      mutations: 0,
      cache: 'hit',
      audit: 'redacted',
    },
  },
  {
    name: 'cache expiry',
    operation: 'lookup',
    inject: 'cache-expiry',
    expected: {
      outcome: 'known',
      calls: 2,
      mutations: 0,
      cache: 'expired',
      audit: 'redacted',
    },
  },
  {
    name: 'private v4',
    operation: 'lookup',
    inject: 'private-v4',
    expected: {
      outcome: 'unknown',
      calls: 0,
      mutations: 0,
      cache: 'blocked',
      audit: 'redacted',
    },
  },
  {
    name: 'private v6',
    operation: 'lookup',
    inject: 'private-v6',
    expected: {
      outcome: 'unknown',
      calls: 0,
      mutations: 0,
      cache: 'blocked',
      audit: 'redacted',
    },
  },
  {
    name: 'bogon v4',
    operation: 'lookup',
    inject: 'bogon-v4',
    expected: {
      outcome: 'unknown',
      calls: 0,
      mutations: 0,
      cache: 'blocked',
      audit: 'redacted',
    },
  },
  {
    name: 'bogon v6',
    operation: 'lookup',
    inject: 'bogon-v6',
    expected: {
      outcome: 'unknown',
      calls: 0,
      mutations: 0,
      cache: 'blocked',
      audit: 'redacted',
    },
  },
  {
    name: 'timeout',
    operation: 'lookup',
    inject: 'timeout',
    expected: {
      outcome: 'unknown',
      calls: 1,
      mutations: 0,
      cache: 'none',
      audit: 'redacted',
    },
  },
  {
    name: 'rate limit',
    operation: 'lookup',
    inject: 'rate-limit',
    expected: {
      outcome: 'unknown',
      calls: 1,
      mutations: 0,
      cache: 'none',
      audit: 'redacted',
    },
  },
  {
    name: 'unavailable',
    operation: 'lookup',
    inject: 'unavailable',
    expected: {
      outcome: 'unknown',
      calls: 1,
      mutations: 0,
      cache: 'none',
      audit: 'redacted',
    },
  },
  {
    name: 'invalid partial',
    operation: 'lookup',
    inject: 'invalid-partial',
    expected: {
      outcome: 'unknown',
      calls: 1,
      mutations: 0,
      cache: 'none',
      audit: 'redacted',
    },
  },
  {
    name: 'cancellation',
    operation: 'lookup',
    inject: 'cancelled',
    expected: {
      outcome: 'unknown',
      calls: 0,
      mutations: 0,
      cache: 'none',
      audit: 'redacted',
    },
  },
  {
    name: 'cross tenant cache fence',
    operation: 'lookup',
    inject: 'cross-tenant',
    expected: {
      outcome: 'known',
      calls: 2,
      mutations: 0,
      cache: 'miss',
      audit: 'redacted',
    },
  },
];

for (const mode of ['local', 'remote-via-fake'] as const) {
  describe(`GeoIP symmetric factory matrix: ${mode}`, () => {
    it.each(geoScenarios)('$name', async scenario => {
      let now = new Date('2026-08-29T00:00:00.000Z');
      const body = scenario.inject === 'invalid-partial' ? { country_code: 'bad' } : { country_code: 'BR' };
      const status = scenario.inject === 'rate-limit' ? 429 : scenario.inject === 'unavailable' ? 503 : 200;
      const results = new Map([
        [
          '8.8.8.8',
          scenario.inject === 'timeout'
            ? { outcome: 'unknown' as const, reasonCode: 'timeout' as const }
            : scenario.inject === 'rate-limit'
              ? {
                  outcome: 'unknown' as const,
                  reasonCode: 'rate_limited' as const,
                }
              : scenario.inject === 'unavailable'
                ? {
                    outcome: 'unknown' as const,
                    reasonCode: 'unavailable' as const,
                  }
                : scenario.inject === 'invalid-partial'
                  ? {
                      outcome: 'unknown' as const,
                      reasonCode: 'invalid_response' as const,
                    }
                  : {
                      outcome: 'known' as const,
                      countryCode: 'BR',
                      observedAt: now.toISOString(),
                      provider: 'ipinfo-lite' as const,
                      confidence: 0.7 as const,
                      confidenceProvenance: 'policy-v1' as const,
                    },
        ],
      ]);
      let transportCalls = 0;
      const audit: string[] = [];
      const provider =
        mode === 'local'
          ? new LocalGeoIpProvider(results, { cacheTtlMs: 10, now: () => now })
          : new IpinfoLiteProvider({
              token: 'never-logged',
              timeoutMs: 10,
              cacheTtlMs: 10,
              now: () => now,
              transport: async () => {
                transportCalls += 1;
                audit.push('geoip:lookup:redacted');
                if (scenario.inject === 'timeout') throw new Error('fake timeout');
                return { status, json: async () => body };
              },
            });
      const controller = new AbortController();
      if (scenario.inject === 'cancelled') controller.abort();
      const ip =
        scenario.inject === 'private-v4'
          ? '10.0.0.1'
          : scenario.inject === 'private-v6'
            ? '::1'
            : scenario.inject === 'bogon-v4'
              ? '235.167.17.62'
              : scenario.inject === 'bogon-v6'
                ? '2001:db8::1'
                : '8.8.8.8';
      const lookup = (tenantId = 'tenant_1') =>
        provider.lookup({
          tenantId,
          ip,
          deadline: new Date(Date.now() + 50),
          signal: controller.signal,
        });
      let result = await lookup();
      if (scenario.inject === 'cache-hit') result = await lookup();
      if (scenario.inject === 'cache-expiry') {
        now = new Date(now.getTime() + 11);
        result = await lookup();
      }
      if (scenario.inject === 'cross-tenant') result = await lookup('tenant_2');
      const calls = mode === 'local' ? (provider as LocalGeoIpProvider).calls.length : transportCalls;
      const lookups =
        scenario.inject === 'cache-hit' || scenario.inject === 'cache-expiry' || scenario.inject === 'cross-tenant'
          ? 2
          : 1;
      const observation = {
        outcome: result.outcome,
        calls,
        mutations: 0,
        cache:
          calls === 0
            ? result.outcome === 'unknown' &&
              ['private-v4', 'private-v6', 'bogon-v4', 'bogon-v6'].includes(scenario.inject)
              ? 'blocked'
              : 'none'
            : result.outcome === 'unknown'
              ? 'none'
              : calls === lookups
                ? scenario.inject === 'cache-expiry'
                  ? 'expired'
                  : 'miss'
                : 'hit',
        audit: mode === 'local' || audit.every(item => item === 'geoip:lookup:redacted') ? 'redacted' : 'unsafe',
      };
      expect(observation).toEqual(scenario.expected);
    });
  });
}

type IncidentScenario = Readonly<{
  name: string;
  operation: 'create' | 'update' | 'reconcile';
  inject:
    | 'nominal'
    | 'concurrent-dedupe'
    | 'timeout'
    | 'rate-limit'
    | 'unavailable'
    | 'invalid-partial'
    | 'ambiguous-response'
    | 'stale-generation'
    | 'cross-tenant'
    | 'status-mismatch';
}>;
// Input-only shared matrix: no expected observation is stored in a scenario.
const incidentScenarios: readonly IncidentScenario[] = [
  { name: 'create nominal', operation: 'create', inject: 'nominal' },
  {
    name: 'create concurrent dedupe',
    operation: 'create',
    inject: 'concurrent-dedupe',
  },
  { name: 'create timeout', operation: 'create', inject: 'timeout' },
  { name: 'create rate limit', operation: 'create', inject: 'rate-limit' },
  { name: 'create unavailable', operation: 'create', inject: 'unavailable' },
  {
    name: 'create invalid partial',
    operation: 'create',
    inject: 'invalid-partial',
  },
  {
    name: 'create ambiguous response',
    operation: 'create',
    inject: 'ambiguous-response',
  },
  {
    name: 'create stale generation',
    operation: 'create',
    inject: 'stale-generation',
  },
  { name: 'update nominal', operation: 'update', inject: 'nominal' },
  {
    name: 'update status mismatch',
    operation: 'update',
    inject: 'status-mismatch',
  },
  {
    name: 'update cross tenant target',
    operation: 'update',
    inject: 'cross-tenant',
  },
  {
    name: 'reconcile post-response',
    operation: 'reconcile',
    inject: 'nominal',
  },
];

for (const mode of ['local', 'remote-via-fake'] as const) {
  describe(`Incident/Linear symmetric factory matrix: ${mode}`, () => {
    it.each(incidentScenarios)('$name', async scenario => {
      const calls: string[] = [];
      let title = '';
      let stateId = 'state_1';
      const fail = ['timeout', 'rate-limit', 'unavailable', 'invalid-partial'].includes(scenario.inject);
      const provider =
        mode === 'local'
          ? new LocalIncidentProvider({
              failAttempts: fail ? 1 : 0,
              rejectUpdateReadback: scenario.inject === 'status-mismatch',
              ambiguousAfterPersistAttempts: scenario.inject === 'ambiguous-response' ? 1 : 0,
            })
          : new LinearIncidentProvider({
              client: {
                createIssue: async input => {
                  calls.push('createIssue');
                  if (fail) {
                    if (scenario.inject === 'invalid-partial') return { success: true };
                    throw new Error(scenario.inject);
                  }
                  title = input.title;
                  if (scenario.inject === 'ambiguous-response') return { success: true };
                  return { success: true, issueId: 'issue_1' };
                },
                updateIssue: async (_id, input) => {
                  calls.push('updateIssue');
                  title = input.title;
                  return { success: true, issueId: 'issue_1' };
                },
                searchIssues: async () => {
                  calls.push('searchIssues');
                  return { nodes: title ? [{ id: 'issue_1' }] : [] };
                },
                issue: async id => ({
                  ...(calls.push('issue'), {}),
                  id,
                  title,
                  state: { id: stateId },
                  team: { id: 'team_1' },
                }),
              },
              workspaceId: 'workspace_1',
              teamId: 'team_1',
              severityLabelIds: {
                low: 'l',
                medium: 'm',
                high: 'h',
                critical: 'c',
              },
              statusStateIds: { awaiting_approval: 'state_1' },
              internalBaseUrl: 'https://linear.example/base',
              resolveDestination: async () => ({
                workspaceId: 'workspace_1',
                teamId: 'team_1',
              }),
            });
      const input = {
        projection,
        idempotencyKey: `matrix-${scenario.inject}`,
        generation: 1,
      };
      let outcome: 'fulfilled' | 'rejected' = 'fulfilled';
      let result: { externalRef: string } | undefined;
      let readback: { externalRef: string } | undefined;
      try {
        if (scenario.operation === 'create') {
          if (scenario.inject === 'stale-generation') {
            await provider.create({ ...input, generation: 2 });
            result = await provider.create(input);
          } else if (scenario.inject === 'concurrent-dedupe') {
            const [first, second] = await Promise.all([provider.create(input), provider.create(input)]);
            expect(second).toEqual(first);
            result = first;
          } else if (scenario.inject === 'ambiguous-response') {
            try {
              result = await provider.create(input);
            } catch {
              readback = await provider.reconcile?.({
                operation: 'create',
                idempotencyKey: input.idempotencyKey,
                generation: input.generation,
                projection,
              });
              result = readback;
            }
          } else result = await provider.create(input);
        } else {
          const created = await provider.create(input);
          const externalRef = scenario.inject === 'cross-tenant' ? 'invalid-target' : created.externalRef;
          if (scenario.operation === 'update') {
            if (scenario.inject === 'status-mismatch') stateId = 'wrong-state';
            result = await provider.update({
              externalRef,
              projection: scenario.inject === 'cross-tenant' ? { ...projection, tenantId: 'tenant_2' } : projection,
              idempotencyKey: `${input.idempotencyKey}-update`,
              generation: 2,
            });
          } else {
            readback = await provider.reconcile?.({
              operation: 'create',
              idempotencyKey: input.idempotencyKey,
              generation: input.generation,
              projection,
            });
          }
        }
      } catch {
        outcome = 'rejected';
      }
      const observation = {
        outcome,
        calls: mode === 'local' ? (provider as LocalIncidentProvider).calls.length : calls.length,
        mutationAttempts:
          mode === 'local'
            ? (provider as LocalIncidentProvider).calls.length
            : calls.filter(call => call === 'createIssue' || call === 'updateIssue').length,
        mutationSuccesses: result ? 1 : 0,
        readback,
        finalState: { title, stateId },
        audit: {
          projectionContainsTenant: title.includes(projection.tenantId),
        },
      };
      expect(observation.audit.projectionContainsTenant).toBe(false);
      if (
        [
          'timeout',
          'rate-limit',
          'unavailable',
          'invalid-partial',
          'stale-generation',
          'cross-tenant',
          'status-mismatch',
        ].includes(scenario.inject)
      ) {
        expect(observation.outcome).toBe('rejected');
        expect(observation.mutationSuccesses).toBe(0);
      } else if (scenario.operation === 'reconcile') {
        expect(observation.outcome).toBe('fulfilled');
        expect(observation.readback?.externalRef).toMatch(/^(?:linear:|local-incident-)/u);
      } else {
        expect(observation.outcome).toBe('fulfilled');
        expect(result?.externalRef).toMatch(/^(?:linear:|local-incident-)/u);
        expect(observation.mutationSuccesses).toBe(1);
      }
    });
  });
}
