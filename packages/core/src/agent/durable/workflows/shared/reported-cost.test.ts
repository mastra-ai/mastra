import { describe, expect, it } from 'vitest';
import { reportedCost } from './reported-cost';

describe('reportedCost', () => {
  it('keeps the cost and drops the rest of the provider metadata', () => {
    const grounding = { groundingChunks: ['x'.repeat(1000)] };
    const usage = { cost: 0.25, costDetails: { upstreamInferenceCost: 0.2 } };

    expect(reportedCost({ google: grounding })).toBeUndefined();
    expect(reportedCost({ google: grounding, gateway: { cost: '0.5', routing: grounding } })).toEqual({
      gateway: { cost: '0.5' },
    });
    expect(reportedCost({ openrouter: { usage, annotations: grounding } })).toEqual({ openrouter: { usage } });
  });
});
