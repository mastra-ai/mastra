import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestContext } from '@mastra/core/request-context';

import type { EvidenceProviderInput } from '../../src/evidence/contracts.js';

import { createEvidenceReadTool, runProviderInspection } from '../../src/mastra/tools/evidence-read-tool.js';
import { LocalCloudEvidenceProvider } from '../../src/providers/cloud-evidence-provider.js';
import { LocalEndpointEvidenceProvider } from '../../src/providers/endpoint-evidence-provider.js';
import { GeoIpIdentityEvidenceProvider } from '../../src/providers/geoip-evidence-provider.js';
import { LocalIdentityEvidenceProvider } from '../../src/providers/identity-evidence-provider.js';

afterEach(() => vi.useRealTimers());

const request = {
  tenantId: 'tenant-1',
  incidentId: 'incident-1',
  subjectId: 'subject-1',
  workflowRunId: 'run-1',
  incidentKind: 'unauthorized_privilege_change' as const,
  occurredAt: '2026-08-27T12:00:00.000Z',
};

describe('evidence collection read-only provider contracts', () => {
  it('keeps the GeoIP wrapper contract valid when a privilege event has no IP', async () => {
    const lookup = vi.fn();
    const provider = new GeoIpIdentityEvidenceProvider({
      base: new LocalIdentityEvidenceProvider(),
      geoip: { lookup },
      timeoutMs: 1_000,
    });

    const output = await runProviderInspection({
      source: 'identity',
      provider,
      request,
      toolCallId: 'tool-call-geoip-no-ip',
      timeoutMs: 1_000,
    });

    expect(lookup).not.toHaveBeenCalled();
    expect(output.result).toMatchObject({
      status: 'success',
      provider: 'identity-geoip',
    });
    if (output.result.status !== 'success') return;
    expect(output.result.facts.length).toBeGreaterThan(0);
    expect(output.result.facts.every(fact => fact.provider === 'local-identity')).toBe(true);
  });

  it('preserves mixed provider provenance when GeoIP adds facts', async () => {
    const provider = new GeoIpIdentityEvidenceProvider({
      base: new LocalIdentityEvidenceProvider(),
      geoip: {
        lookup: async () => ({
          outcome: 'known',
          countryCode: 'BR',
          asn: 'AS123',
          observedAt: request.occurredAt,
          provider: 'ipinfo-lite',
          confidence: 0.7,
          confidenceProvenance: 'policy-v1',
        }),
      },
      timeoutMs: 1_000,
    });

    const output = await runProviderInspection({
      source: 'identity',
      provider,
      request: { ...request, ip: '8.8.8.8' },
      toolCallId: 'tool-call-geoip-known',
      timeoutMs: 1_000,
    });

    expect(output.result).toMatchObject({
      status: 'success',
      provider: 'identity-geoip',
    });
    if (output.result.status !== 'success') return;
    expect(output.result.facts.some(fact => fact.provider === 'local-identity')).toBe(true);
    expect(output.result.facts.some(fact => fact.provider === 'identity-geoip')).toBe(true);
  });

  it('starts IPinfo without waiting for WorkOS to finish', async () => {
    let releaseBase = () => {};
    const basePending = new Promise<void>(resolve => {
      releaseBase = resolve;
    });
    const lookup = vi.fn(async () => ({
      outcome: 'known' as const,
      countryCode: 'BR',
      observedAt: request.occurredAt,
      provider: 'ipinfo-lite' as const,
      confidence: 0.7 as const,
      confidenceProvenance: 'policy-v1' as const,
    }));
    const provider = new GeoIpIdentityEvidenceProvider({
      base: {
        source: 'identity',
        providerId: 'workos-identity',
        inspect: async () => {
          await basePending;
          return {
            status: 'success' as const,
            provider: 'workos-identity',
            facts: [
              {
                semanticKey: 'identity.user.status',
                factType: 'user.status',
                value: 'active',
                observedAt: request.occurredAt,
                confidence: 1,
                confidenceProvenance: 'provider' as const,
                rawPayloadRef: 'protected:test-workos',
                sensitivity: 'confidential' as const,
                incomplete: false,
              },
            ],
          };
        },
      },
      geoip: { lookup },
      timeoutMs: 1_000,
    });

    const inspection = provider.inspect(
      { ...request, ip: '200.160.2.3' },
      { signal: new AbortController().signal, attempt: 1 },
    );
    await vi.waitFor(() => expect(lookup).toHaveBeenCalledOnce());
    releaseBase();
    await expect(inspection).resolves.toMatchObject({ status: 'success' });
  });

  it('lets IPinfo remain the only country authority in integrated mode', async () => {
    const provider = new LocalCloudEvidenceProvider({
      countryByIp: {},
      includeIpPresence: false,
    });
    const result = await provider.inspect(
      {
        ...request,
        incidentKind: 'disallowed_country_login',
        sessionId: 'session-1',
        ip: '200.160.2.3',
      },
      { signal: new AbortController().signal, attempt: 1 },
    );

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.facts.some(fact => fact.factType === 'login.country')).toBe(false);
    expect(result.facts.some(fact => fact.factType === 'login.ipPresent')).toBe(false);
    expect(result.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ factType: 'policy.allowedCountry' }),
        expect.objectContaining({ factType: 'session.abnormalHistory' }),
      ]),
    );
  });

  it.each([
    [new LocalIdentityEvidenceProvider(), 'local-identity'],
    [new LocalEndpointEvidenceProvider(), 'local-endpoint'],
    [new LocalCloudEvidenceProvider(), 'local-cloud'],
  ])('returns strict deterministic synthetic facts', async (provider, providerName) => {
    const first = await provider.inspect(request, {
      signal: new AbortController().signal,
      attempt: 1,
    });
    const second = await provider.inspect(request, {
      signal: new AbortController().signal,
      attempt: 1,
    });
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      status: 'success',
      provider: providerName,
    });
    expect(provider.calls).toHaveLength(2);
    expect(JSON.stringify(first)).not.toContain('ignore prior');
  });

  it('retries only explicit retryable failures once', async () => {
    const provider = new LocalCloudEvidenceProvider({
      behavior: 'rate_limited',
    });
    const output = await runProviderInspection({
      source: 'cloud',
      provider,
      request,
      toolCallId: 'tool-call-1',
      timeoutMs: 1_000,
    });
    expect(provider.calls.map(call => call.attempt)).toEqual([1, 2]);
    expect(output.result).toMatchObject({
      status: 'rate_limited',
      error: { code: 'RATE_LIMITED', attempt: 2 },
    });
    const invalid = new LocalCloudEvidenceProvider({
      behavior: 'invalid_response',
    });
    await runProviderInspection({
      source: 'cloud',
      provider: invalid,
      request,
      toolCallId: 'tool-call-2',
      timeoutMs: 1_000,
    });
    expect(invalid.calls).toHaveLength(1);
  });

  it.each([
    ['timeout', 'TIMEOUT'],
    ['not_found', 'NOT_FOUND'],
    ['invalid_response', 'INVALID_RESPONSE'],
    ['aborted', 'ABORTED'],
  ] as const)('ignores adapter retry claims for the local non-retryable %s policy', async (status, code) => {
    let calls = 0;
    const provider = {
      source: 'cloud' as const,
      providerId: 'policy-adversary',
      inspect: async () => {
        calls += 1;
        return {
          status,
          provider: 'policy-adversary',
          error: {
            code,
            retryable: true,
            safeRef: 'provider:policy-adversary:forged-retry',
            attempt: 1,
          },
        };
      },
    };
    const output = await runProviderInspection({
      source: 'cloud',
      provider,
      request,
      toolCallId: `tool-call-${status}`,
      timeoutMs: 1_000,
    });
    expect(calls).toBe(1);
    expect(output.result).toMatchObject({
      status: 'invalid_response',
      error: { code: 'INVALID_RESPONSE', retryable: false },
    });
  });

  it('does not retry a coherent provider timeout', async () => {
    const provider = new LocalEndpointEvidenceProvider({ behavior: 'timeout' });
    const output = await runProviderInspection({
      source: 'endpoint',
      provider,
      request,
      toolCallId: 'tool-call-timeout-policy',
      timeoutMs: 1_000,
    });
    expect(provider.calls).toHaveLength(1);
    expect(output.result).toMatchObject({
      status: 'timeout',
      error: { code: 'TIMEOUT', retryable: false },
    });
  });

  it('derives the reported attempt and safe reference from the actual call', async () => {
    let calls = 0;
    const provider = {
      source: 'cloud' as const,
      providerId: 'attempt-adversary',
      inspect: async () => {
        calls += 1;
        const actualAttempt = calls as 1 | 2;
        return {
          status: actualAttempt === 1 ? 'rate_limited' : 'unavailable',
          provider: 'attempt-adversary',
          error: {
            code: actualAttempt === 1 ? 'RATE_LIMITED' : 'UNAVAILABLE',
            retryable: true,
            safeRef: 'provider:attempt-adversary:forged',
            attempt: actualAttempt === 1 ? 2 : 1,
          },
        };
      },
    };
    const output = await runProviderInspection({
      source: 'cloud',
      provider,
      request,
      toolCallId: 'tool-call-attempt-policy',
      timeoutMs: 1_000,
    });
    expect(calls).toBe(2);
    expect(output.result).toMatchObject({
      status: 'unavailable',
      error: {
        attempt: 2,
        safeRef: 'provider:attempt-adversary:attempt-2',
      },
    });
  });

  it('does not retry an operational timeout exception', async () => {
    let calls = 0;
    const provider = {
      source: 'endpoint' as const,
      providerId: 'timeout-adapter',
      inspect: async () => {
        calls += 1;
        throw Object.assign(new Error('deadline exceeded'), {
          name: 'TimeoutError',
          code: 'TIMEOUT',
        });
      },
    };
    const output = await runProviderInspection({
      source: 'endpoint',
      provider,
      request,
      toolCallId: 'tool-call-thrown-timeout',
      timeoutMs: 1_000,
    });
    expect(calls).toBe(1);
    expect(output.result).toMatchObject({
      status: 'timeout',
      error: { code: 'TIMEOUT', retryable: false },
    });
  });

  it('propagates abort without exposing an arbitrary interface', async () => {
    const controller = new AbortController();
    controller.abort();
    const provider = new LocalEndpointEvidenceProvider();
    const output = await runProviderInspection({
      source: 'endpoint',
      provider,
      request,
      toolCallId: 'tool-call-3',
      timeoutMs: 1_000,
      parentSignal: controller.signal,
    });
    expect(output.result).toMatchObject({ error: { code: 'ABORTED' } });
    expect(output).not.toHaveProperty('url');
    expect(output).not.toHaveProperty('query');
  });

  it('rejects unknown fields and trusted-scope mismatches before the adapter', async () => {
    const provider = new LocalIdentityEvidenceProvider();
    const tool = createEvidenceReadTool({
      id: 'identity-read-tool',
      source: 'identity',
      description: 'test',
      provider,
      timeoutMs: 1_000,
    });
    expect(
      tool.inputSchema?.['~standard'].validate({
        ...request,
        url: 'https://invalid',
      }),
    ).toMatchObject({
      issues: expect.any(Array),
    });
    const requestContext = new RequestContext<EvidenceProviderInput>([
      ['tenantId', 'other-tenant'],
      ['incidentId', request.incidentId],
      ['subjectId', request.subjectId],
      ['workflowRunId', request.workflowRunId],
      ['incidentKind', request.incidentKind],
      ['occurredAt', request.occurredAt],
    ]);
    await expect(
      tool.execute?.(request, {
        requestContext,
        observe: {
          span: async (_name, fn) => fn(),
          log: () => {},
        },
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(provider.calls).toHaveLength(0);
  });

  it.each([
    ['identity' as const, new LocalIdentityEvidenceProvider()],
    ['endpoint' as const, new LocalEndpointEvidenceProvider()],
    ['cloud' as const, new LocalCloudEvidenceProvider()],
  ])('rejects every model-controlled selector mismatch for %s', async (source, provider) => {
    const trusted = {
      ...request,
      sessionId: 'session-trusted',
      deviceId: 'device-known-1',
      ip: '198.51.100.8',
    };
    const tool = createEvidenceReadTool({
      id: `${source}-read-tool`,
      source,
      description: 'test',
      provider,
      timeoutMs: 1_000,
    });
    const requestContext = new RequestContext<EvidenceProviderInput>([
      ['tenantId', trusted.tenantId],
      ['incidentId', trusted.incidentId],
      ['subjectId', trusted.subjectId],
      ['workflowRunId', trusted.workflowRunId],
      ['incidentKind', trusted.incidentKind],
      ['occurredAt', trusted.occurredAt],
      ['sessionId', trusted.sessionId],
      ['deviceId', trusted.deviceId],
      ['ip', trusted.ip],
    ]);
    const mismatches = [
      { ...trusted, incidentKind: 'unknown_device_login' as const },
      { ...trusted, occurredAt: '2026-08-27T12:00:01.000Z' },
      { ...trusted, sessionId: 'session-attacker' },
      { ...trusted, deviceId: 'device-attacker' },
      { ...trusted, ip: '203.0.113.9' },
    ];
    for (const mismatch of mismatches) {
      await expect(
        tool.execute?.(mismatch, {
          requestContext,
          observe: {
            span: async (_name, fn) => fn(),
            log: () => {},
          },
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    }
    expect(provider.calls).toHaveLength(0);
  });

  it('enforces the deadline when a provider ignores AbortSignal', async () => {
    vi.useFakeTimers();
    let release!: (value: unknown) => void;
    const provider = {
      source: 'cloud' as const,
      providerId: 'local-cloud',
      inspect: () =>
        new Promise<unknown>(resolve => {
          release = resolve;
        }),
    };
    const completion = runProviderInspection({
      source: 'cloud',
      provider,
      request,
      toolCallId: 'tool-call-deadline',
      timeoutMs: 10,
    });
    await vi.advanceTimersByTimeAsync(10);
    await expect(completion).resolves.toMatchObject({
      result: { status: 'timeout', error: { code: 'TIMEOUT' } },
    });
    release({ status: 'success', provider: 'local-cloud', facts: [] });
    await vi.runAllTimersAsync();
  });

  it('turns a truly malformed provider response into a typed partial failure', async () => {
    const provider = {
      source: 'cloud' as const,
      providerId: 'local-cloud',
      inspect: async () => ({
        status: 'success',
        provider: 'local-cloud',
        facts: [
          {
            semanticKey: 'bad-time',
            observedAt: 'bad-time',
            factType: 'login.country',
            value: 'US',
            confidence: 1,
            confidenceProvenance: 'provider',
            rawPayloadRef: 'protected:test:bad-time',
            sensitivity: 'internal',
            incomplete: false,
          },
        ],
      }),
    };
    await expect(
      runProviderInspection({
        source: 'cloud',
        provider,
        request,
        toolCallId: 'tool-call-invalid',
        timeoutMs: 1_000,
      }),
    ).resolves.toMatchObject({
      result: {
        status: 'invalid_response',
        error: { code: 'INVALID_RESPONSE', retryable: false },
      },
    });
  });

  it('supports real adapter identities while rejecting a wrong domain', async () => {
    const workos = {
      source: 'identity' as const,
      providerId: 'workos',
      inspect: async () => ({
        status: 'success',
        provider: 'workos',
        facts: [
          {
            semanticKey: 'subject',
            observedAt: request.occurredAt,
            factType: 'identity.subject',
            value: request.subjectId,
            confidence: 1,
            confidenceProvenance: 'provider',
            rawPayloadRef: 'protected:workos:subject',
            sensitivity: 'confidential',
            incomplete: false,
          },
        ],
      }),
    };
    await expect(
      runProviderInspection({
        source: 'identity',
        provider: workos,
        request,
        toolCallId: 'tool-call-workos',
        timeoutMs: 1_000,
      }),
    ).resolves.toMatchObject({ result: { provider: 'workos' } });
    await expect(
      runProviderInspection({
        source: 'cloud',
        provider: workos,
        request,
        toolCallId: 'tool-call-wrong-domain',
        timeoutMs: 1_000,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
