/** Ported from validation harness case T11 (resumable-streams). */
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../../../../agent/durable/constants';
import type { ChunkType } from '../../../../stream';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

const replayTypes = new Map<string, string[]>();
const gate = () => Promise.withResolvers<void>();

function assertComplete(chunks: ChunkType[]) {
  const calls = chunks.filter(chunk => chunk.type === 'tool-call');
  const results = chunks.filter(chunk => chunk.type === 'tool-result');
  expect(calls).toHaveLength(3);
  expect(results).toHaveLength(3);
  expect(new Set(calls.map(chunk => chunk.payload.toolCallId)).size).toBe(3);
  expect(results.map(chunk => chunk.payload.toolCallId)).toEqual(calls.map(chunk => chunk.payload.toolCallId));
  expect(chunks.filter(chunk => chunk.type === 'finish')).toHaveLength(1);
  expect(chunks.map(chunk => chunk.type)).not.toContain('error');
}

describeForAllEngines(
  'Reattaching preserves the run without repeating effects (COR-1409)',
  engine => {
    const getMock = useLoopScenarioAimock();
    for (const variant of ['reconnect', 'offset', 'late', 'dead'] as const) {
      it(`${variant}: an independent observer replays or closes without hanging`, async () => {
        const llm = getMock();
        const entered = [gate(), gate(), gate()];
        const released = [gate(), gate(), gate()];
        const commits: number[] = [];
        for (let done = 0; done < 3; done++) {
          llm.on(
            {
              endpoint: 'chat',
              predicate: body => {
                const messages = (body as { messages?: { role: string }[] }).messages ?? [];
                return messages.filter(message => message.role === 'tool').length === done;
              },
            },
            { toolCalls: [{ id: `call_${done + 1}`, name: 'step', arguments: { n: done + 1 } }] },
          );
        }
        llm.on(
          {
            endpoint: 'chat',
            predicate: body =>
              ((body as { messages?: { role: string }[] }).messages ?? []).filter(message => message.role === 'tool')
                .length === 3,
          },
          { content: 'finished 3 steps' },
        );
        const step = createTool({
          id: 'step',
          description: 'Commit one step.',
          inputSchema: z.object({ n: z.number().int().min(1).max(3) }),
          execute: async ({ n }) => {
            entered[n - 1]!.resolve();
            await released[n - 1]!.promise;
            commits.push(n);
            return { n };
          },
        });
        const { agent, mastra } = await createSharedAgent(llm, { engine, tools: { step } });
        const run = await agent.stream('Run three steps', { maxSteps: 5 });
        const live: ChunkType[] = [];
        const consuming = (async () => {
          for await (const chunk of run.output.fullStream) live.push(chunk);
        })();
        let observation: Awaited<ReturnType<typeof agent.observe>> | undefined;
        let observing: Promise<void> | undefined;
        let guard: ReturnType<typeof setTimeout> | undefined;
        const observed: ChunkType[] = [];
        try {
          await entered[0]!.promise;
          if (variant === 'dead') {
            observation = await agent.observe(run.runId, { idleTimeoutMs: 50 });
          } else if (variant === 'late') {
            released.forEach(g => g.resolve());
            await consuming;
            observation = await agent.observe(run.runId);
          } else {
            const first = await agent.observe(run.runId);
            const prefix: ChunkType[] = [];
            const disconnected = (async () => {
              for await (const chunk of first.output.fullStream) {
                prefix.push(chunk);
                if (chunk.type === 'tool-result') {
                  first.detach();
                  break;
                }
              }
            })();
            released[0]!.resolve();
            await disconnected;
            await entered[1]!.promise;
            // The cache's numeric event index includes lifecycle events, not just chunks.
            const history = await agent.pubsub.getHistory(AGENT_STREAM_TOPIC(run.runId));
            const boundary = history.find(
              event =>
                event.type === AgentStreamEventTypes.CHUNK &&
                event.data.type === 'tool-result' &&
                event.data.payload.toolCallId === 'call_1',
            );
            expect(boundary?.index).toBeTypeOf('number');
            if (variant === 'offset') observed.push(...prefix);
            observation = await agent.observe(
              run.runId,
              variant === 'offset' ? { offset: boundary!.index! + 1 } : undefined,
            );
          }
          const suffix: ChunkType[] = [];
          observing = (async () => {
            for await (const chunk of observation!.output.fullStream) suffix.push(chunk);
          })();
          const timeout = new Promise<never>((_, reject) => {
            guard = setTimeout(() => {
              observation?.detach();
              reject(new Error('Observer exceeded hang guard'));
            }, 3000);
          });
          if (variant !== 'dead') released.forEach(g => g.resolve());
          await Promise.race([observing, timeout]);
          observed.push(...suffix);
          if (variant === 'dead') {
            expect(suffix.map(chunk => chunk.type)).toContain('error');
            expect(commits).toEqual([]);
            // A bare observer timeout must not cancel the still-live producer.
            released.forEach(g => g.resolve());
            await consuming;
            assertComplete(live);
            expect(commits).toEqual([1, 2, 3]);
          } else {
            await consuming;
            assertComplete(observed);
            expect(commits).toEqual([1, 2, 3]);
            if (variant === 'offset') {
              const boundaryChunkIndex = live.findIndex(
                chunk => chunk.type === 'tool-result' && chunk.payload.toolCallId === 'call_1',
              );
              expect(boundaryChunkIndex).toBeGreaterThanOrEqual(0);
              expect(suffix[0]?.type).not.toBe('start');
              expect(suffix).toEqual(live.slice(boundaryChunkIndex + 1));
            } else {
              expect(observed).toEqual(live);
            }
            if (variant === 'late') {
              replayTypes.set(
                engine,
                observed.map(chunk => chunk.type),
              );
              if (replayTypes.has('durable') && replayTypes.has('evented')) {
                expect(replayTypes.get('evented')).toEqual(replayTypes.get('durable'));
              }
            }
          }
        } finally {
          clearTimeout(guard);
          observation?.detach();
          released.forEach(g => g.resolve());
          await Promise.allSettled([consuming, ...(observing ? [observing] : [])]);
          run.cleanup?.();
          if (engine !== 'inngest') await mastra.shutdown();
        }
      }, 15000);
    }
    // COR-1409: normal and filesystem agents do not expose observe().
    // #28175: Inngest observe lacks detach() and idleTimeoutMs support.
  },
  { skip: ['normal', 'fs', 'inngest'] },
);
