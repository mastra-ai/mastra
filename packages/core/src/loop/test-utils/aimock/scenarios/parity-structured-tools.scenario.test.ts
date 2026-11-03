/**
 * Ported from validation harness case T48 (structured-tools), source 23f640a.
 * A tool side effect must commit before the final JSON answer is parsed.
 * Restart cells and partial object streaming are out of scope.
 */
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { chunksOfType, describeParity, expectParity, textOnlyTape, toolCallTape } from '../parity';

const OBJECT = { reply: 'finished 1 steps', number: 1 };
const OPTIONS = {
  maxSteps: 4,
  memory: { thread: 't48-thread', resource: 't48-resource' },
  structuredOutput: { schema: z.object({ reply: z.string(), number: z.number() }) },
};

describeParity('structured-tools parity', target => {
  it('parses the final object after committing the tool exactly once', async () => {
    const commits = new Map<string, number[]>();
    const observations = await expectParity(target, {
      model: { tapes: [toolCallTape('step', { n: 1 }, 't48-step'), textOnlyTape(JSON.stringify(OBJECT))] },
      differences: {
        [target]: {
          reason: 'COR-1390: wrapped engines emit object-result after step-finish but before finish.',
          expect: plain => {
            const expected = structuredClone(plain);
            for (const turn of expected.turns) {
              const index = turn.chunkTypes.indexOf('object-result');
              expect(index).toBeGreaterThan(-1);
              const finishIndex = turn.chunkTypes.indexOf('finish');
              for (const list of [turn.chunkTypes, turn.chunks, turn.chunkPayloads]) {
                const [result] = list.splice(index, 1);
                list.splice(finishIndex - 1, 0, result!);
              }
            }
            return expected;
          },
        },
      },
      buildAgent: ({ engine, model }) => {
        const committed: number[] = [];
        commits.set(engine, committed);
        return new Agent({
          id: 't48-agent',
          name: 'T48 Agent',
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
        const turn = await handle.turn('Go.', OPTIONS);
        expect(commits.get(handle.engine)).toEqual([1]);
        expect(turn.fullOutput.object).toEqual(OBJECT);
        expect(turn.error).toBeUndefined();
        expect(chunksOfType(turn, 'finish')).toBe(1);
        expect(chunksOfType(turn, 'error')).toBe(0);
      },
    });
    for (const engine of ['plain', target] as const) {
      const observation = observations[engine]!;
      expect(observation.requests.map(request => request.responseFormat?.type ?? 'none')).toEqual(['json', 'json']);
      expect(observation.requests).toHaveLength(2);
      const turn = observation.turns[0]!;
      const objectIndex = turn.chunkTypes.indexOf('object-result');
      expect(objectIndex).toBeGreaterThan(turn.chunkTypes.indexOf('tool-result'));
      expect(objectIndex).toBeLessThan(turn.chunkTypes.indexOf('finish'));
    }
  });
});
