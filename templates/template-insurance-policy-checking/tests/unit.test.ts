import { describe, it, expect } from 'vitest';
import { inputLimits, inputLimitsSchema } from '../src/config/limits.js';
import { applicationConfigurationSchema, clarifySchema } from '../src/mastra/domain/contracts.js';
import { insuranceConfiguration, insuranceConfigurationSchema } from '../src/config/insurance.js';
import { resolveControlledProviderEndpoint } from '../src/mastra/runtime/server.js';
import { failureText } from '../src/mastra/domain/errors.js';
import { sourceBundleSchema } from '../src/mastra/domain/contracts.js';
import { recordProvider } from './fixtures.js';
import { randomUUID } from 'node:crypto';

describe('Intake contract invariants', () => {
  it('rejects invalid local runtime settings before storage or model work', () => {
    expect(applicationConfigurationSchema.parse({ port: '4111' })).toEqual({
      port: 4111,
      operatorId: 'local-broker',
      dataDirectory: '.runtime',
    });
    for (const port of ['1023', '65536', '4111.5', 'Infinity', ''])
      expect(applicationConfigurationSchema.safeParse({ port }).success).toBe(false);
    for (const setting of [{ operatorId: '' }, { operatorId: 'x'.repeat(201) }, { dataDirectory: '' }])
      expect(applicationConfigurationSchema.safeParse(setting).success).toBe(false);
    expect(
      insuranceConfigurationSchema.safeParse({ ...insuranceConfiguration, defaultProfileId: 'missing' }).success,
    ).toBe(false);
    expect(
      insuranceConfigurationSchema.safeParse({
        ...insuranceConfiguration,
        profiles: [...insuranceConfiguration.profiles, ...insuranceConfiguration.profiles],
      }).success,
    ).toBe(false);
    expect(
      insuranceConfigurationSchema.safeParse({
        ...insuranceConfiguration,
        profiles: [
          { ...insuranceConfiguration.profiles[0], rules: [{ id: '', description: 'Invalid empty rule identifier' }] },
        ],
      }).success,
    ).toBe(false);
  });
  it('allows controlled providers only on the test-mode loopback boundary', () => {
    expect(resolveControlledProviderEndpoint({ NODE_ENV: 'production' })).toBeUndefined();
    expect(resolveControlledProviderEndpoint({ NODE_ENV: 'test', POLICY_TEST_PROVIDER_URL: '' })).toBeUndefined();
    expect(
      resolveControlledProviderEndpoint({ NODE_ENV: 'test', POLICY_TEST_PROVIDER_URL: 'http://127.0.0.1:4982/v1' }),
    ).toBe('http://127.0.0.1:4982/v1');
    for (const environment of [
      { NODE_ENV: 'production', POLICY_TEST_PROVIDER_URL: 'http://127.0.0.1:4982/v1' },
      { NODE_ENV: 'test', POLICY_TEST_PROVIDER_URL: 'https://127.0.0.1:4982/v1' },
      { NODE_ENV: 'test', POLICY_TEST_PROVIDER_URL: 'http://localhost:4982/v1' },
      { NODE_ENV: 'test', POLICY_TEST_PROVIDER_URL: 'https://SENTINEL_PRIVATE_PROVIDER_SECRET.invalid/v1' },
    ]) {
      expect(() => resolveControlledProviderEndpoint(environment)).toThrow(
        'A controlled test provider must run on loopback in test mode.',
      );
      try {
        resolveControlledProviderEndpoint(environment);
      } catch (error) {
        expect(failureText(error)).not.toContain('SENTINEL_PRIVATE_PROVIDER_SECRET');
      }
    }
  });
  it('requires a distinct reference and target and never infers contractual acceptance', () => {
    const reference = randomUUID(),
      target = randomUUID();
    const request = {
      caseId: randomUUID(),
      expectedRevision: 1,
      identity: { policyNumber: null, insuredName: null, insuranceProduct: null },
      intent: 'document_comparison',
      referenceId: reference,
      targetId: target,
      roles: [
        { sourceId: reference, role: 'proposal' },
        { sourceId: target, role: 'proposal' },
      ],
      acceptedBaseline: null,
    };
    expect(clarifySchema.safeParse(request).success).toBe(true);
    expect(clarifySchema.safeParse({ ...request, targetId: reference }).success).toBe(false);
    expect(clarifySchema.safeParse({ ...request, intent: 'agreed_terms_checking' }).success).toBe(false);
    expect(
      clarifySchema.safeParse({
        ...request,
        intent: 'agreed_terms_checking',
        roles: [
          { sourceId: reference, role: 'proposal' },
          { sourceId: target, role: 'issued_policy' },
        ],
        acceptedBaseline: { sourceId: reference, statement: 'Broker explicitly confirms this proposal was accepted.' },
      }).success,
    ).toBe(true);
  });
  it('rejects unusable and unsafe capacity configuration without clamping', () => {
    for (const value of [0, -1, 1, 2.1, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])
      expect(inputLimitsSchema.safeParse({ ...inputLimits, maxDocumentsPerCase: value }).success).toBe(false);
    for (const key of ['maxBytesPerFile', 'maxPagesPerFile', 'maxPagesPerCase'])
      for (const value of [0, -1, 0.5, Infinity, NaN])
        expect(inputLimitsSchema.safeParse({ ...inputLimits, pdf: { ...inputLimits.pdf, [key]: value } }).success).toBe(
          false,
        );
    expect(
      inputLimitsSchema.parse({ ...inputLimits, pdf: { ...inputLimits.pdf, maxPagesPerCase: 1 } }).pdf.maxPagesPerCase,
    ).toBe(1);
  });
  it('rejects duplicate source IDs at the shared boundary', async () => {
    const provider = recordProvider();
    const bundle = await provider.capture({}, { threadId: 'one', operatorId: 'broker' }, inputLimits);
    expect(sourceBundleSchema.safeParse({ sources: [bundle.sources[0], bundle.sources[0]] }).success).toBe(false);
  });
  it('does not echo arbitrary schema keys, exception text or credentials', () => {
    const secret = 'SENTINEL_PRIVATE_PROVIDER_SECRET';
    expect(failureText(new Error(secret))).not.toContain(secret);
    const result = inputLimitsSchema.safeParse({ [secret]: secret });
    if (!result.success) expect(failureText(result.error)).not.toContain(secret);
  });
});
