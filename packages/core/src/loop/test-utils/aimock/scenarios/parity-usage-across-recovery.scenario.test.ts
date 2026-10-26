/**
 * Ported from validation harness case T84 (usage-across-recovery), source 23f640a.
 * These are the fault-free legs: committed usage omissions must not become zero
 * or a complete-looking partial sum. Restart cells belong to COR-1449.
 */
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { chunksOfType, describeParity, expectParity, textOnlyTape, toolCallTape } from '../parity';

const USAGES = [
  { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
  { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
  { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
];

describeParity('usage-across-recovery fault-free parity', target => {
  it.each(['known-then-known', 'known-then-omitted', 'omitted-then-known'] as const)(
    '%s: terminal usage preserves knowledge across committed tool steps',
    async variant => {
      const commits = new Map<string, number[]>();
      const tapes = [
        toolCallTape('step', { n: 1 }, 't84-1', USAGES[0]),
        toolCallTape('step', { n: 2 }, 't84-2', USAGES[1]),
        textOnlyTape('done', USAGES[2]),
      ];
      for (const [index, tape] of tapes.entries()) {
        if ((variant === 'known-then-omitted' && index > 0) || (variant === 'omitted-then-known' && index === 0)) {
          for (const chunk of tape)
            if (chunk.type === 'finish')
              chunk.usage = { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined };
        }
      }
      const observations = await expectParity(target, {
        model: { tapes },
        buildAgent: ({ engine, model }) => {
          const committed: number[] = [];
          commits.set(engine, committed);
          return new Agent({
            id: 't84-agent',
            name: 'T84 Agent',
            instructions: 'Follow the script.',
            model,
            memory: new MockMemory(),
            tools: {
              step: createTool({
                id: 'step',
                description: 'Commit a step.',
                inputSchema: z.object({ n: z.number() }),
                execute: async ({ n }) => {
                  committed.push(n);
                  return { done: n };
                },
              }),
            },
          });
        },
        run: async handle => {
          const turn = await handle.turn('Go.', {
            maxSteps: 5,
            memory: { thread: 't84-thread', resource: 't84-resource' },
          });
          expect(turn.error).toBeUndefined();
          expect(turn.text).toBe('done');
          expect(chunksOfType(turn, 'finish')).toBe(1);
          expect(commits.get(handle.engine)).toEqual([1, 2]);
          if (variant === 'known-then-known') {
            expect(turn.usage).toMatchObject({ inputTokens: 111, outputTokens: 222, totalTokens: 333 });
          } else {
            for (const key of ['inputTokens', 'outputTokens', 'totalTokens'] as const) {
              expect(typeof turn.usage[key]).not.toBe('number');
              expect(turn.usage[key]).not.toBe(0);
            }
          }
          expect(turn.finishChunk.payload.output.usage).toEqual(turn.usage);
          expect(turn.fullOutput.usage).toEqual(turn.usage);
        },
      });
      for (const engine of ['plain', target] as const) expect(observations[engine]!.requests).toHaveLength(3);
    },
  );
});
