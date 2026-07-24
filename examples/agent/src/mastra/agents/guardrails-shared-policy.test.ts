import { evaluateGuardrailPolicy } from '@mastra/core/guardrails';
import { describe, expect, it } from 'vitest';
import { customerDataPolicy } from './guardrails-shared-policy';

describe('customerDataPolicy', () => {
  it('allows ordinary customer-support input', async () => {
    const report = await evaluateGuardrailPolicy(customerDataPolicy, {
      input: 'Help the customer reset their password.',
    });

    expect(report.matched).toBe(false);
    expect(report.blocked).toBe(false);
  });

  it('blocks API keys before the policy is attached to an agent', async () => {
    const report = await evaluateGuardrailPolicy(customerDataPolicy, {
      input: 'Use api_key = abcdefghijklmnopqrstuvwxyz for the request.',
    });

    expect(report.matched).toBe(true);
    expect(report.blocked).toBe(true);
    expect(report.violations).toEqual([
      expect.objectContaining({
        policyName: 'customer-data-policy',
        group: 'privacy',
        check: 'secrets',
        action: 'block',
      }),
    ]);
  });
});
