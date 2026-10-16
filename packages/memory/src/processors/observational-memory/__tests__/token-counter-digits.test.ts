import { describe, expect, it } from 'vitest';

import { TokenCounter } from '../token-counter';

describe('TokenCounter digit runs', () => {
  it('counts long digit runs in chunks instead of as a single token', () => {
    const counter = new TokenCounter();
    expect(counter.countString('0'.repeat(28_000))).toBeGreaterThan(9_000);
    expect(counter.countString('12345678901234567890')).toBeGreaterThanOrEqual(7);
    expect(counter.countString('1700000000000')).toBeGreaterThanOrEqual(5);
    expect(counter.countString('hello world this is text')).toBe(5);
  });

  it('re-estimates tool results whose persisted estimates predate the digit-run fix', () => {
    const part: any = {
      type: 'tool-invocation',
      toolInvocation: {
        state: 'result',
        toolCallId: 'digits',
        toolName: 'lookup',
        args: {},
        result: '1'.repeat(28_000),
      },
    };
    const message: any = {
      id: 'digits-message',
      role: 'assistant',
      createdAt: new Date(),
      content: { format: 2, parts: [part] },
    };

    new TokenCounter().countMessage(message);

    // Rewrite the stamped entries into what tokenx 1.3.0 persisted under cache version 7.
    const estimates = part.providerMetadata.mastra.tokenEstimate;
    const entries = Object.values(estimates).filter((entry: any) => entry && typeof entry === 'object');
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries as any[]) {
      entry.v = 7;
      entry.source = entry.source.replace(/^v\d+:/, 'v7:');
      entry.tokens = 1;
    }

    expect(new TokenCounter().countMessage(message)).toBeGreaterThan(9_000);
  });
});
