import { describe, expect, it, vi } from 'vitest';

import { classifySeverity } from '../../src/mastra/steps/classify-severity.js';
import { assertSeverityDecision, buildSeverityDecision } from '../../src/triage/decision-validation.js';
import { deterministicResponsePlanner } from '../../src/triage/prompt-safe-decision.js';
import { triageContext } from '../fixtures/triage.js';

describe('triage hybrid classification', () => {
  it.each([
    ['unauthorized_privilege_change', 'high'],
    ['disallowed_country_login', 'medium'],
    ['unknown_device_login', 'medium'],
  ] as const)('keeps code authoritative for %s', async (kind, severity) => {
    const result = await classifySeverity(
      triageContext(kind, {
        includeAggravating: kind === 'unauthorized_privilege_change',
      }),
      deterministicResponsePlanner,
    );
    expect(result).toMatchObject({
      status: 'classified',
      decision: { severity, effectiveConfidence: 1, policyVersion: 1 },
    });
    if (result.status === 'classified') {
      expect(result.decision.references.at(-1)).toBe(result.decision.runbookReference);
      expect(result.decision.severity).not.toBe('critical');
    }
  });

  it('uses manual review when the model materially diverges', async () => {
    const result = await classifySeverity(triageContext(), async ({ candidate }) => ({
      ...candidate,
      assessment: 'contradicts-policy',
    }));
    expect(result).toEqual({
      status: 'manual-review',
      incidentId: 'incident-1',
      reasonCodes: ['MODEL_DIVERGENCE'],
    });
  });

  it('rejects a severity decision altered between workflow steps', () => {
    const context = triageContext();
    const decision = buildSeverityDecision(context);
    expect(() => assertSeverityDecision(context, decision)).not.toThrow();
    expect(() => assertSeverityDecision(context, { ...decision, severity: 'low' })).toThrow();
  });

  it('retries schema output once, but never retries an operational failure', async () => {
    const schemaDouble = vi.fn(async ({ candidate }, attempt: 1 | 2) =>
      attempt === 1 ? { invalid: true } : candidate,
    );
    expect((await classifySeverity(triageContext(), schemaDouble)).status).toBe('classified');
    expect(schemaDouble).toHaveBeenCalledTimes(2);

    const unavailable = vi.fn(async () => {
      throw new Error('provider unavailable');
    });
    expect(await classifySeverity(triageContext(), unavailable)).toMatchObject({
      status: 'manual-review',
      reasonCodes: ['MODEL_UNAVAILABLE'],
    });
    expect(unavailable).toHaveBeenCalledOnce();
  });
});
