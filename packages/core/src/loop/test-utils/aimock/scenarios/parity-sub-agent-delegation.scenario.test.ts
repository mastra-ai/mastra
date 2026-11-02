/**
 * Ported from validation harness case T12 (sub-agent-delegation), source 23f640a.
 * The worker's two side effects and answer must reach the supervisor exactly once.
 * Restart/atomic delegation checks belong to COR-1449, not this fault-free port.
 */
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import type { ParityEngine } from '../parity';
import {
  chunksOfType,
  createRecordingModel,
  describeParity,
  expectParity,
  textOnlyTape,
  toolCallTape,
} from '../parity';

describeParity('sub-agent-delegation parity', target => {
  it('worker commits both steps and delivers its answer to the supervisor', async () => {
    const states = new Map<ParityEngine, { memory: MockMemory; commits: number[] }>();
    let targetThreadId: string;
    const results = await expectParity(target, {
      differences: {
        [target]: {
          reason:
            'COR-1390: each delegation generates a fresh subAgentThreadId; compare all other result fields exactly.',
          expect: plain => {
            const expected = structuredClone(plain);
            const replaceId = (result: unknown) => ({
              ...z.looseObject({ subAgentThreadId: z.string() }).parse(result),
              subAgentThreadId: targetThreadId,
            });
            const replaceMessageIds = (payload: unknown) => {
              const { messages } = payload as {
                messages: Record<
                  'all' | 'nonUser',
                  Array<{ content: Array<{ type: string; toolName: string; output: { value: unknown } }> }>
                >;
              };
              for (const list of [messages.all, messages.nonUser]) {
                for (const message of list) {
                  for (const part of message.content) {
                    if (part.type === 'tool-result' && part.toolName === 'agent-worker') {
                      part.output.value = replaceId(part.output.value);
                    }
                  }
                }
              }
            };
            for (const turn of expected.turns) {
              turn.chunkTypes.forEach((type, index) => {
                if (type === 'tool-result') {
                  const payload = turn.chunkPayloads[index] as { toolName: string; result: unknown };
                  if (payload.toolName === 'agent-worker') payload.result = replaceId(payload.result);
                }
                if (type === 'finish') replaceMessageIds(turn.chunkPayloads[index]);
              });
              replaceMessageIds(turn.finishChunk.payload);
              for (const result of turn.toolResults) {
                if (result.toolName === 'agent-worker') result.result = replaceId(result.result);
              }
            }
            return expected;
          },
        },
      },
      run: async handle => {
        const turn = await handle.turn('Get the steps done.', {
          maxSteps: 4,
          memory: { thread: 't12-thread', resource: 't12-resource' },
        });
        const delegation = turn.toolResults.find(result => result.toolName === 'agent-worker')!;
        const result = z.looseObject({ subAgentThreadId: z.string() }).parse(delegation.result);
        expect(result.subAgentThreadId).toMatch(/^t12-thread-[0-9a-f-]{36}$/);
        if (handle.engine === target) targetThreadId = result.subAgentThreadId;
      },
      model: {
        respond: request => {
          const results = request.prompt.flatMap(message => (message.role === 'tool' ? message.content : []));
          return results.length
            ? textOnlyTape(`delegated ${JSON.stringify(results.at(-1))}`)
            : toolCallTape('agent-worker', { prompt: 'Do both steps.' }, 't12-delegation');
        },
      },
      buildAgent: ({ engine, model }) => {
        const state = { memory: new MockMemory(), commits: [] as number[] };
        states.set(engine, state);
        const worker = new Agent({
          id: 't12-worker',
          name: 'worker',
          description: 'Performs the numbered steps.',
          instructions: 'Follow the script.',
          model: createRecordingModel({
            tapes: [
              toolCallTape('step', { n: 1 }, 't12-step-1'),
              toolCallTape('step', { n: 2 }, 't12-step-2'),
              textOnlyTape('finished 2 steps'),
            ],
          }).model,
          tools: {
            step: createTool({
              id: 'step',
              description: 'Commit one numbered step.',
              inputSchema: z.object({ n: z.number() }),
              execute: async ({ n }) => {
                state.commits.push(n);
                return { n };
              },
            }),
          },
        });
        return new Agent({
          id: 't12-supervisor',
          name: 'supervisor',
          instructions: 'Follow the script.',
          model,
          memory: state.memory,
          agents: { worker },
        });
      },
      input: 'Get the steps done.',
      options: { maxSteps: 4, memory: { thread: 't12-thread', resource: 't12-resource' } },
    });
    for (const engine of ['plain', target] as const) {
      const state = states.get(engine)!;
      const turn = results[engine]!.turns[0]!;
      expect(state.commits).toEqual([1, 2]);
      expect(turn.error).toBeUndefined();
      expect(chunksOfType(turn, 'finish')).toBe(1);
      expect(chunksOfType(turn, 'error')).toBe(0);
      expect(turn.text.startsWith('delegated')).toBe(true);
      const delegation = turn.toolResults.filter(result => result.toolName === 'agent-worker');
      expect(delegation).toHaveLength(1);
      expect(JSON.stringify(delegation[0]!.result)).toContain('finished 2 steps');
      const publicResult = turn.chunkPayloads[turn.chunkTypes.indexOf('tool-result')];
      expect(publicResult).toMatchObject({
        toolName: 'agent-worker',
        providerMetadata: { mastra: { modelOutput: { type: 'text', value: 'finished 2 steps' } } },
      });
      const { messages } = await state.memory.recall({ threadId: 't12-thread', resourceId: 't12-resource' });
      const parts = messages
        .flatMap(message => message.content.parts ?? [])
        .filter(part => part.type === 'tool-invocation' && part.toolInvocation.toolName === 'agent-worker');
      expect(parts).toHaveLength(1);
      expect(parts[0]!.toolInvocation.state).toBe('result');
    }
  });
});
