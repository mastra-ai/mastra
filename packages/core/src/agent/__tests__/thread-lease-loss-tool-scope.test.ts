import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { beforeEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../memory/mock';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { ControlledLeasePubSub } from './signals-test-utils';

vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '300';
  process.env.MASTRA_AGENT_THREAD_LEASE_LOST_TOOL_GRACE_MS = '1500';
});

beforeEach(() => agentThreadStreamRuntime.resetForTests());

class CountingLeasePubSub extends ControlledLeasePubSub {
  lostRenewals = 0;
  override async renewLease(key: string, owner: string) {
    const renewed = await super.renewLease(key, owner);
    if (!renewed) this.lostRenewals++;
    return renewed;
  }
}

it.each([
  'different run ids',
  'the same run id',
  'the same run id on the same thread',
  'the same agent id and run id on the same thread',
] as const)(
  'a run that lost its lease waits only for its own running tool, not another runtime run with %s',
  async variant => {
    const runs = [0, 1].map(index => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      let started = false;
      let toolAborted = false;
      let calls = 0;
      const pubsub = new CountingLeasePubSub();
      const target =
        variant === 'the same run id on the same thread' ||
        variant === 'the same agent id and run id on the same thread'
          ? { resource: 'scope-resource', thread: 'scope-thread' }
          : { resource: `scope-resource-${index}`, thread: `scope-thread-${index}` };
      const model = new MockLanguageModelV2({
        doStream: async () => {
          calls++;
          return {
            warnings: [],
            stream: convertArrayToReadableStream(
              calls === 1
                ? [
                    { type: 'stream-start', warnings: [] },
                    { type: 'tool-call', toolCallId: `call-${index}`, toolName: 'hold', input: '{}' },
                    { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1 } },
                  ]
                : [
                    { type: 'stream-start', warnings: [] },
                    { type: 'text-start', id: `answer-${index}` },
                    { type: 'text-delta', id: `answer-${index}`, delta: 'asked again' },
                    { type: 'text-end', id: `answer-${index}` },
                    { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1 } },
                  ],
            ),
          };
        },
      });
      const hold = createTool({
        id: 'hold',
        description: 'Wait',
        inputSchema: z.object({}),
        execute: async (_input, context) => {
          started = true;
          context?.abortSignal?.addEventListener('abort', () => (toolAborted = true), { once: true });
          await gate;
          return `result ${index}`;
        },
      });
      const agent = new Agent({
        id: variant === 'the same agent id and run id on the same thread' ? 'scope-owner' : `scope-owner-${index}`,
        name: 'Owner',
        instructions: 'Call hold',
        model,
        tools: { hold },
        memory: new MockMemory(),
        pubsub,
      });
      return {
        pubsub,
        agent,
        target,
        key: `${target.resource}\u0000${target.thread}`,
        release,
        started: () => started,
        calls: () => calls,
        toolAborted: () => toolAborted,
      };
    });
    const aborts = runs.map(() => new AbortController());
    const outputs: Awaited<ReturnType<Agent['stream']>>[] = [];
    const done: Promise<void>[] = [];
    try {
      for (const [index, run] of runs.entries()) {
        const output = await run.agent.stream('hold', {
          runId: variant === 'different run ids' ? `run-${index}` : 'shared-run',
          memory: run.target,
          maxSteps: 3,
          abortSignal: aborts[index]!.signal,
        });
        outputs.push(output);
        done.push(output.consumeStream());
        await vi.waitFor(() => expect(run.started()).toBe(true));
      }
      const [lost, other] = runs as [(typeof runs)[number], (typeof runs)[number]];
      // Another run takes the first thread; the second runtime's run keeps its lease and its tool keeps running.
      lost.pubsub.owners.set(lost.key, 'successor-run');
      await vi.waitFor(() => expect(lost.pubsub.lostRenewals).toBeGreaterThan(0));
      expect(lost.toolAborted()).toBe(false);
      lost.release();
      await done[0];

      // Its own tool done, the run stops without asking the model again, whatever the other runtime is running.
      expect(lost.calls()).toBe(1);
      expect(await outputs[0]!.finishReason).toBe('aborted');
      expect(other.toolAborted()).toBe(false);
    } finally {
      for (const run of runs) run.release();
      for (const abort of aborts) abort.abort();
      await Promise.all(done.map(promise => promise.catch(() => {})));
    }
  },
  8_000,
);
