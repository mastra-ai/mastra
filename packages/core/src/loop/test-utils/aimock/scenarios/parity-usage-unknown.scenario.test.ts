/**
 * Missing provider measurements are unknown, not free tokens (#25402).
 * Consolidates durable-agent-usage-unknown and durable-agent-usage-partial-omission
 * (T69/T83): omitted, selectively omitted, explicit-zero, and measured usage.
 */
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { createTool } from '../../../../tools';
import { describeParity, expectParity, type ModelTape } from '../parity';

const known = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const cases = [
  { name: 'all omitted', first: undefined, second: undefined, expected: [undefined, undefined, undefined] },
  { name: 'known then omitted', first: known, second: undefined, expected: [undefined, undefined, undefined] },
  { name: 'partially omitted', first: known, second: { inputTokens: 1 }, expected: [2, undefined, undefined] },
  {
    name: 'explicit zero',
    first: known,
    second: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    expected: [1, 1, 2],
  },
  { name: 'all present', first: known, second: known, expected: [2, 2, 4] },
] as const;

describeParity('unknown provider usage parity', target => {
  it.each(cases)('$name: stream and resolved usage preserve measurement uncertainty', async testCase => {
    const results = await expectParity(target, {
      model: {
        respond: (_request, index): ModelTape => {
          const usage = index === 0 ? testCase.first : testCase.second;
          return [
            { type: 'stream-start', warnings: [] },
            ...(index === 0
              ? [{ type: 'tool-call' as const, toolCallId: 'usage-call', toolName: 'step', input: '{}' }]
              : [
                  { type: 'text-start' as const, id: 'usage-text' },
                  { type: 'text-delta' as const, id: 'usage-text', delta: 'done' },
                  { type: 'text-end' as const, id: 'usage-text' },
                ]),
            { type: 'finish', finishReason: index === 0 ? 'tool-calls' : 'stop', ...(usage ? { usage } : {}) },
          ];
        },
      },
      buildAgent: ({ model }) =>
        new Agent({
          id: 'unknown-usage-agent',
          name: 'Usage-aware assistant',
          instructions: 'Take one step, then answer.',
          model,
          tools: {
            step: createTool({
              id: 'step',
              description: 'Take a step',
              inputSchema: z.object({}),
              execute: async () => 'ok',
            }),
          },
        }),
      input: 'Go',
      options: { maxSteps: 2 },
    });
    for (const engine of ['plain', target] as const) {
      const result = results[engine]!;
      expect(result.requests).toHaveLength(2);
      const turn = result.turns[0]!;
      expect(turn.text).toBe('done');
      for (const usage of [turn.usage, turn.fullOutput.usage, turn.finishChunk?.usage]) {
        expect([usage?.inputTokens, usage?.outputTokens, usage?.totalTokens]).toEqual(testCase.expected);
      }
    }
  });
});
