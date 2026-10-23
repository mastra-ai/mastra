import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventEmitterPubSub } from '../../events/event-emitter';
import { Agent } from '../agent';
import { AgentThreadStreamRuntime, agentThreadStreamRuntime } from '../thread-stream-runtime';
import { withTimeout } from './signals-test-utils';

describe('Agent signals: thread serialization', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });

  describe('same-agent thread serialization', () => {
    const threadId = 'same-agent-wait-thread';
    const resourceId = 'same-agent-wait-user';

    const registerRunningRun = async (
      runtime: AgentThreadStreamRuntime,
      agent: Agent<any, any, any, any>,
      runId: string,
    ) => {
      let finish!: () => void;
      const finished = new Promise<void>(resolve => {
        finish = resolve;
      });
      const output = {
        runId,
        status: 'running',
        fullStream: new ReadableStream({
          start(controller) {
            void finished.then(() => controller.close());
          },
        }),
        _waitUntilFinished: () => finished,
      } as any;
      await runtime.registerRun(agent, output, { memory: { thread: threadId, resource: resourceId } } as any);
      return {
        output,
        finish: () => {
          output.status = 'success';
          finish();
        },
      };
    };

    it('serializes a new same-agent stream() behind an actively running record', async () => {
      const runtime = new AgentThreadStreamRuntime();
      const agent = { id: 'same-agent-wait-agent' } as Agent<any, any, any, any>;
      const run = await registerRunningRun(runtime, agent, 'same-agent-wait-run-1');

      let resolved = false;
      const wait = runtime
        .waitForCrossAgentThreadRun(agent, { memory: { thread: threadId, resource: resourceId } })
        .then(() => {
          resolved = true;
        });
      await new Promise(resolve => setTimeout(resolve, 25));
      expect(resolved).toBe(false);

      run.finish();
      await withTimeout(wait, 'Timed out waiting for the same-agent wait to release');
      expect(resolved).toBe(true);
    });

    it('does not wait when the caller targets the active run (continuation)', async () => {
      const runtime = new AgentThreadStreamRuntime();
      const agent = { id: 'same-agent-continuation-agent' } as Agent<any, any, any, any>;
      const run = await registerRunningRun(runtime, agent, 'same-agent-continuation-run');

      await withTimeout(
        runtime.waitForCrossAgentThreadRun(agent, {
          memory: { thread: threadId, resource: resourceId },
          runId: 'same-agent-continuation-run',
        }),
        'Continuation wait should resolve immediately',
      );

      run.finish();
    });

    it('does not wait on a same-agent suspended record', async () => {
      const runtime = new AgentThreadStreamRuntime();
      const agent = { id: 'same-agent-suspended-agent' } as Agent<any, any, any, any>;
      const run = await registerRunningRun(runtime, agent, 'same-agent-suspended-run');
      run.output.status = 'suspended';

      await withTimeout(
        runtime.waitForCrossAgentThreadRun(agent, { memory: { thread: threadId, resource: resourceId } }),
        'Suspended-record wait should resolve immediately',
      );

      run.finish();
    });

    it('keeps blocking a same-agent contender during a partial resume with sibling suspensions', async () => {
      const runtime = new AgentThreadStreamRuntime();
      const pubsub = new EventEmitterPubSub();
      const publish = vi.spyOn(pubsub, 'publish');
      const agent = { id: 'same-agent-partial-resume-agent' } as Agent<any, any, any, any>;
      const runId = 'same-agent-partial-resume-run';
      const options = { memory: { thread: threadId, resource: resourceId } } as any;

      let finishRun!: () => void;
      const finished = new Promise<void>(resolve => {
        finishRun = resolve;
      });
      let parts!: ReadableStreamDefaultController<unknown>;
      const output = {
        runId,
        status: 'running',
        fullStream: new ReadableStream({
          start(controller) {
            parts = controller;
          },
        }),
        _waitUntilFinished: () => finished,
      } as any;
      await runtime.registerRun(agent, output, options, pubsub, { continuation: 'across-suspension' });

      // Two sibling tool calls suspend within the same segment.
      parts.enqueue({ type: 'tool-call-approval', runId, payload: { toolCallId: 'call-1', toolName: 'one' } });
      parts.enqueue({ type: 'tool-call-approval', runId, payload: { toolCallId: 'call-2', toolName: 'two' } });
      await vi.waitFor(() =>
        expect(
          publish.mock.calls.filter(([, event]) => (event as any).data?.part?.type === 'tool-call-approval'),
        ).toHaveLength(2),
      );
      output.status = 'suspended';

      // Fully suspended: a same-agent contender must not wait on human input.
      await withTimeout(
        runtime.waitForCrossAgentThreadRun(agent, options, pubsub),
        'Fully suspended wait should resolve immediately',
      );

      // Resume only call-1. call-2 stays suspended, but the resumed segment is
      // actively executing — a new same-agent run must wait for it.
      const resumed = {
        runId,
        status: 'running',
        consumeStream: async () => {},
      } as any;
      expect(runtime.continueRun(agent, resumed, { ...options, toolCallId: 'call-1' }, pubsub)).toBe(true);

      let resolved = false;
      const wait = runtime.waitForCrossAgentThreadRun(agent, options, pubsub).then(() => {
        resolved = true;
      });
      await new Promise(resolve => setTimeout(resolve, 25));
      expect(resolved).toBe(false);

      // The resumed segment settles; the contender is released.
      resumed.status = 'success';
      output.status = 'success';
      finishRun();
      await withTimeout(wait, 'Timed out waiting for the partial-resume wait to release');
      expect(resolved).toBe(true);
    });

    it('still waits on a different-agent running record', async () => {
      const runtime = new AgentThreadStreamRuntime();
      const owner = { id: 'other-agent-owner' } as Agent<any, any, any, any>;
      const run = await registerRunningRun(runtime, owner, 'other-agent-run');

      let resolved = false;
      const wait = runtime
        .waitForCrossAgentThreadRun({ id: 'other-agent-contender' } as Agent<any, any, any, any>, {
          memory: { thread: threadId, resource: resourceId },
        })
        .then(() => {
          resolved = true;
        });
      await new Promise(resolve => setTimeout(resolve, 25));
      expect(resolved).toBe(false);

      run.finish();
      await withTimeout(wait, 'Timed out waiting for the cross-agent wait to release');
      expect(resolved).toBe(true);
    });

    it('serializes two concurrent agent.stream() calls on the same thread', async () => {
      let concurrent = 0;
      let maxConcurrent = 0;
      const model = new MockLanguageModelV2({
        doStream: async () => {
          concurrent += 1;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise(resolve => setTimeout(resolve, 25));
          concurrent -= 1;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'serialized response' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
          };
        },
      });
      const agent = new Agent({
        id: 'concurrent-stream-agent',
        name: 'Concurrent Stream Agent',
        instructions: 'Test',
        model,
      });
      const memory = { thread: 'concurrent-stream-thread', resource: 'concurrent-stream-user' };

      const [first, second] = await Promise.all([
        agent.stream('first message', { memory }),
        agent.stream('second message', { memory }),
      ]);
      await Promise.all([first.consumeStream(), second.consumeStream()]);

      expect(maxConcurrent).toBe(1);
    });
  });
});
