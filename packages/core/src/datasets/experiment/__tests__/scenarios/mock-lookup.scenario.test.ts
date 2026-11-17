import { describe, expect, it } from 'vitest';
import { recordingTool, runToolMockScenario } from './scenario-helpers';

describe('Replay tool lookup', () => {
  it('serves calls in candidate order and scores a completed answer after misses without running live tools', async () => {
    const live: string[] = [];
    const { item, summary } = await runToolMockScenario({
      toolMockMatchMode: 'lookup',
      unmockedToolPolicy: 'deny',
      tools: { search: recordingTool('search', live), charge: recordingTool('charge', live) },
      toolMocks: [
        { toolName: 'search', args: { q: 'first' }, output: { answer: 'one' } },
        { toolName: 'search', args: { q: 'second' }, output: { answer: 'two' } },
        { toolName: 'unused', args: {}, output: 'unused' },
      ],
      turns: [
        {
          toolCalls: [
            { id: 'wrong', toolName: 'search', args: { q: 'other' } },
            { id: 'second', toolName: 'search', args: { q: 'second' } },
            { id: 'first', toolName: 'search', args: { q: 'first' } },
            { id: 'extra', toolName: 'search', args: { q: 'first' } },
            { id: 'unknown', toolName: 'charge', args: { amount: 100 } },
          ],
        },
        { text: 'The recorded answers are one and two.' },
      ],
    });
    expect(summary.succeededCount).toBe(1);
    expect(item.output).toMatchObject({ text: 'The recorded answers are one and two.' });
    expect(live).toEqual([]);
    expect(item.toolMockReport).toMatchObject({
      matchMode: 'lookup',
      served: [
        { mockIndex: 1, callIndex: 1, args: { q: 'second' } },
        { mockIndex: 0, callIndex: 2, args: { q: 'first' } },
      ],
      misses: [
        { toolName: 'search', reason: 'args-mismatch', closestArgs: { q: 'first' } },
        { toolName: 'search', reason: 'exhausted' },
        { toolName: 'charge', reason: 'not-recorded' },
      ],
      unconsumed: [{ mockIndex: 2, toolName: 'unused' }],
    });
    expect(item.toolMockReport?.failure).toBeUndefined();
  });
});
