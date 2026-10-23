import { describe, it, expect } from 'vitest';
import { inputLimits, inputLimitsSchema } from '../config/limits.js';
import { clarifySchema } from '../src/mastra/storage/cases.js';
import { failureText } from '../src/mastra/services/errors.js';
import { sourceBundleSchema } from '../src/mastra/services/contracts.js';
import { recordProvider } from './fixtures.js';
import { randomUUID } from 'node:crypto';

describe('Intake contract invariants', () => {
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
