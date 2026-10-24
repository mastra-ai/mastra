import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { inputLimits, inputLimitsSchema } from '../src/mastra/config/input-limits-config.js';
import { insuranceConfiguration, insuranceConfigurationSchema } from '../src/mastra/config/insurance-config.js';
import {
  applicationConfigurationSchema,
  clarifySchema,
  sourceBundleSchema,
} from '../src/mastra/domain/case-contracts.js';
import { compareDecimals, normalizeDecimal } from '../src/mastra/domain/decimal-utils.js';
import { failureText } from '../src/mastra/domain/operation-errors.js';
import {
  extractionSchema,
  processingBudgetSchema,
  termValueSchema,
} from '../src/mastra/domain/reconciliation-contracts.js';
import { equalValues, valueSupported, verifyEvidence } from '../src/mastra/domain/reconciliation-engine.js';
import { resolveControlledProviderEndpoint } from '../src/mastra/runtime/local-server.js';
import { processingDiagnostics } from '../src/mastra/runtime/operation-logger.js';
import { recordProvider } from './input-fixtures.js';
import { propertyMoney } from './reconciliation-fixtures.js';

it('native_diagnostics_survive_serialization_without_copying_error_content', () => {
  const validationError = new z.ZodError([
    { code: 'custom', path: ['terms', 0, 'evidence'], message: 'SENTINEL_PRIVATE_ISSUE' },
    { code: 'custom', path: ['SENTINEL_PRIVATE_DYNAMIC_KEY'], message: 'private' },
  ]);
  const error = new MastraError(
    {
      id: 'STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.SYSTEM,
      text: 'SENTINEL_PRIVATE_ERROR',
    },
    validationError,
  );
  const direct = processingDiagnostics(validationError);
  expect(direct.issues).toEqual([{ code: 'custom', path: ['terms', 0, 'evidence'] }]);
  expect(processingDiagnostics(error).nativeErrorCode).toBe('STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED');
  expect(processingDiagnostics(JSON.parse(JSON.stringify(error)))).toMatchObject({
    nativeErrorCode: 'STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED',
    nativeErrorKind: 'MastraError',
    nativeErrorShape: 'object',
  });
  for (const name of [
    'AI_NoOutputGeneratedError',
    'AI_InvalidResponseDataError',
    'AI_APICallError',
    'AI_NoContentGeneratedError',
    'AbortError',
    'TimeoutError',
  ])
    expect(processingDiagnostics({ name }).nativeErrorKind).toBe(name);
  expect(processingDiagnostics({ cause: { name: 'AI_NoObjectGeneratedError', finishReason: 'length' } })).toMatchObject(
    { nativeErrorKind: 'AI_NoObjectGeneratedError', finishReason: 'length' },
  );
  expect(processingDiagnostics({ cause: { cause: { cause: error } } }).nativeErrorCode).toBeUndefined();
  expect(JSON.stringify(direct)).not.toContain('SENTINEL_PRIVATE');
});

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
    expect(
      clarifySchema.safeParse({ ...request, roles: [request.roles[0], { sourceId: randomUUID(), role: 'reference' }] })
        .success,
    ).toBe(false);
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

describe('Typed insurance comparison boundaries', () => {
  it('rejects repeated record review locators and terms that differ only in scope formatting', () => {
    const extraction = {
      sourceId: randomUUID(),
      terms: [],
      reviewedPages: [],
      reviewedRecords: [{ recordId: 'policy', field: 'limit' }],
      complete: true,
      limitations: [],
      changes: [],
    };
    expect(extractionSchema.safeParse(extraction).success).toBe(true);
    expect(
      extractionSchema.safeParse({
        ...extraction,
        reviewedRecords: [...extraction.reviewedRecords, ...extraction.reviewedRecords],
      }).success,
    ).toBe(false);
    const term = {
      category: 'limit',
      key: 'building',
      label: 'Building limit',
      scope: 'All premises',
      value: propertyMoney('2500'),
      original: 'USD 2500 each occurrence, fixed.',
      uncertainty: [],
      evidence: [
        {
          sourceId: extraction.sourceId,
          version: '1',
          hash: 'a'.repeat(64),
          physicalPage: null,
          recordId: 'policy',
          field: 'limit',
          excerpt: 'USD 2500 each occurrence, fixed.',
        },
      ],
    };
    expect(
      extractionSchema.safeParse({ ...extraction, terms: [term, { ...term, scope: ' ALL   PREMISES ' }] }).success,
    ).toBe(false);
    expect(
      extractionSchema.safeParse({ ...extraction, terms: [term, { ...term, scope: 'Warehouse B' }] }).success,
    ).toBe(true);
  });
  it('compares exact decimal amounts without rounding away money or comparison dimensions', () => {
    expect(equalValues(propertyMoney('9007199254740993.0100'), propertyMoney('9007199254740993.01'))).toBe(true);
    expect(equalValues(propertyMoney('9007199254740993.01'), propertyMoney('9007199254740993.02'))).toBe(false);
    expect(equalValues(propertyMoney('2500'), propertyMoney('2500', 'CAD'))).toBe(false);
    expect(equalValues(propertyMoney('5'), propertyMoney('5', 'USD', 'percentage'))).toBe(false);
    const money = propertyMoney('2500');
    if (money.type !== 'money') throw new Error('Money fixture');
    expect(equalValues(money, { ...money, unit: 'each claim' })).toBe(false);
    expect(equalValues(money, { ...money, minimum: '100' })).toBe(false);
    expect(normalizeDecimal('-0.0000')).toBe('0');
    expect(normalizeDecimal('-100.00010')).toBe('-100.0001');
    expect(compareDecimals('9007199254740993.0100000000000001', '9007199254740993.01')).toBe(1);
    expect(compareDecimals('-0.0000000000000002', '-0.0000000000000001')).toBe(-1);
    expect(compareDecimals('2500000.00', '2500000')).toBe(0);
    expect(
      termValueSchema.safeParse({ ...money, minimum: '999999999999999999.02', maximum: '999999999999999999.01' })
        .success,
    ).toBe(false);
    expect(termValueSchema.safeParse({ ...money, amount: 2500 }).success).toBe(false);
    expect(termValueSchema.safeParse({ ...money, amount: '2.5e3' }).success).toBe(false);
  });
  it('preserves calendar granularity and distinct entities, addresses and units', () => {
    expect(termValueSchema.safeParse({ type: 'date', value: '2026-02-29', granularity: 'day' }).success).toBe(false);
    expect(termValueSchema.safeParse({ type: 'date', value: '2024-02-29', granularity: 'day' }).success).toBe(true);
    expect(termValueSchema.safeParse({ type: 'date', value: '2026-01', granularity: 'day' }).success).toBe(false);
    expect(
      equalValues(
        { type: 'date', value: '2026', granularity: 'year' },
        { type: 'date', value: '2026-01-01', granularity: 'day' },
      ),
    ).toBe(false);
    const entity = { type: 'entity' as const, name: 'Warehouse A', address: '18 Cedar Lane', unit: 'Unit 1' };
    expect(equalValues(entity, { ...entity, name: ' warehouse   a ' })).toBe(true);
    expect(equalValues(entity, { ...entity, name: 'Warehouse B' })).toBe(false);
    expect(equalValues(entity, { ...entity, address: '18 Cedar Road' })).toBe(false);
    expect(equalValues(entity, { ...entity, unit: 'Unit 2' })).toBe(false);
  });
  it('rejects normalization unsupported by original values and forged record citations', async () => {
    expect(valueSupported(propertyMoney('5000'), 'Deductible: USD 2500 each occurrence, fixed.')).toBe(false);
    expect(valueSupported(propertyMoney('5'), 'Deductible: USD 5 percent each occurrence.')).toBe(false);
    expect(valueSupported(propertyMoney('2500'), 'Deductible: USD 2,500.00 each occurrence, fixed.')).toBe(true);
    const bundle = await recordProvider().capture({}, { threadId: 'one', operatorId: 'broker' }, inputLimits);
    const source = bundle.sources[0]!;
    const evidence = {
      sourceId: source.sourceId,
      version: source.version,
      hash: source.hash,
      physicalPage: null,
      recordId: 'contract',
      field: 'limit',
      excerpt: 'USD 250000',
    };
    expect(() => verifyEvidence(evidence, [source])).not.toThrow();
    expect(() => verifyEvidence({ ...evidence, field: 'invented' }, [source])).toThrow();
    expect(() => verifyEvidence({ ...evidence, excerpt: 'USD 999999' }, [source])).toThrow();
    expect(() => verifyEvidence({ ...evidence, hash: '0'.repeat(64) }, [source])).toThrow();
    expect(processingBudgetSchema.safeParse({ maxRequests: 10 }).success).toBe(false);
  });
});
