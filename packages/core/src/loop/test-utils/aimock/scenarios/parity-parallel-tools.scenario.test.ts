/**
 * Ported from validation harness case T31 (parallel-tools).
 * Source: 23f640a. Staggered streaming belongs to COR-1344; recovery to COR-1449.
 * Result ordering within a parallel step is recorded, not asserted by the source.
 */
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { chunksOfType, describeParity, expectParity, textOnlyTape, toolCallTape } from '../parity';

describeParity('parallel-tools parity', target => {
  it.each(['all-ok', 'one-throws'] as const)(
    '%s: every parallel result reaches the next model request',
    async variant => {
      const commits = new Map<string, number[]>();
      const calls = [1, 2, 3].map(n =>
        toolCallTape(n === 2 && variant === 'one-throws' ? 'boom' : 'step', { n }, `t31-${n}`),
      );
      await expectParity(target, {
        model: {
          tapes: [
            [
              ...calls[0]!.slice(0, 2),
              ...calls.flatMap(tape => tape.filter(chunk => chunk.type === 'tool-call')),
              calls[0]!.at(-1)!,
            ],
            textOnlyTape('got 3 results'),
          ],
        },
        ...(variant === 'one-throws'
          ? {
              differences: {
                [target]: {
                  reason:
                    'COR-1390: wrapped tool-error chunks serialize the error instead of exposing the plain MastraError; T31 explicitly excludes ordering inside a parallel step.',
                  expect: plain => {
                    const expected = structuredClone(plain);
                    const turn = expected.turns[0]!;
                    for (const values of [turn.chunkPayloads, turn.chunkTypes, turn.chunks]) {
                      [values[5], values[6]] = [values[6]!, values[5]!];
                    }
                    turn.chunkPayloads[6]!.error = { name: 'Error', message: 'T31 tool failure' };
                    return expected;
                  },
                },
              },
            }
          : {}),
        buildAgent: ({ model, engine }) => {
          const committed: number[] = [];
          commits.set(engine, committed);
          return new Agent({
            id: 't31-agent',
            name: 'T31 Agent',
            instructions: 'Run all steps.',
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
              boom: createTool({
                id: 'boom',
                description: 'Fail a step.',
                inputSchema: z.object({ n: z.number() }),
                execute: async () => {
                  throw new Error('T31 tool failure');
                },
              }),
            },
          });
        },
        options: { maxSteps: 3, memory: { thread: 't31-thread', resource: 't31-resource' } },
        input: 'Go.',
        run: async handle => {
          const turn = await handle.turn('Go.', {
            maxSteps: 3,
            memory: { thread: 't31-thread', resource: 't31-resource' },
          });
          expect(commits.get(handle.engine)!.sort()).toEqual(variant === 'all-ok' ? [1, 2, 3] : [1, 3]);
          expect(turn.text).toBe('got 3 results');
          expect(turn.error).toBeUndefined();
          expect(chunksOfType(turn, 'finish')).toBe(1);
          expect(chunksOfType(turn, 'error')).toBe(0);
          expect(chunksOfType(turn, 'tool-call')).toBe(3);
          expect(chunksOfType(turn, 'tool-result')).toBe(variant === 'all-ok' ? 3 : 2);
          expect(chunksOfType(turn, 'tool-error')).toBe(variant === 'all-ok' ? 0 : 1);
        },
      }).then(observations => {
        for (const observation of [observations.plain, observations[target]!]) {
          expect(observation.requests).toHaveLength(2);
          const results = observation.requests[1]!.prompt.filter(message => message.role === 'tool').flatMap(
            message => message.content,
          );
          expect(results).toHaveLength(3);
          expect(results.map(result => result.toolName).sort()).toEqual(
            variant === 'all-ok' ? ['step', 'step', 'step'] : ['boom', 'step', 'step'],
          );
        }
      });
    },
  );
});
