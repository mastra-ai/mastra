import { describe, expect, it, vi } from 'vitest';
import { createStatelessOrganizationAgent as createOrganizationAgent } from '../../fixtures/agent.js';
import { fixedLanguageModel } from '../../fixtures/model.js';
import { index } from './helpers/runtime.js';

describe('grounded answer finalization', () => {
  it.each(['valid', 'invalid', 'provider failure'] as const)('emits and observes a %s answer only once', async kind => {
    const onGroundedAnswer = vi.fn();
    const onGroundedUsage = vi.fn();
    const answer = JSON.stringify({
      status: 'answered',
      answer: 'Invoices are retained for seven years.',
      citations: [{ recordId: 'policy-retention', locator: 'Retention' }],
    });
    const model = fixedLanguageModel(kind === 'invalid' ? '{invalid' : answer, {
      ...(kind === 'provider failure' ? { error: new Error('private provider error') } : {}),
    });
    const agent = createOrganizationAgent(index(), model as never, {
      onGroundedAnswer,
      onGroundedUsage,
      maxRetries: 0,
    });
    const stream = await agent.stream('How long are invoices retained?');
    const visible = [];
    for await (const part of stream.fullStream) {
      if (part.type === 'text-delta') visible.push(JSON.parse(part.payload.text));
    }
    expect(visible).toHaveLength(1);
    expect(visible[0].status).toBe(kind === 'valid' ? 'answered' : 'operational_error');
    expect(onGroundedAnswer).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ answer: visible[0] }));
    expect(onGroundedUsage).toHaveBeenCalledTimes(1);
    if (kind !== 'provider failure')
      expect(onGroundedUsage).toHaveBeenCalledWith({ inputTokens: 1, outputTokens: 1, totalTokens: 2 });
  });
});
