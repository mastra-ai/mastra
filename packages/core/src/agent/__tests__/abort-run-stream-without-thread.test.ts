import { fork } from 'node:child_process';

import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';

import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory';
import { MockStore } from '../../storage';
import { Agent } from '../agent';
import { AgentThreadStreamRuntime, agentThreadStreamRuntime } from '../thread-stream-runtime';

function createParkedModel() {
  let started!: () => void;
  const startedPromise = new Promise<void>(resolve => {
    started = resolve;
  });
  let observedAbort = false;

  const model = new MockLanguageModelV2({
    doStream: async ({ abortSignal }) => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({
            type: 'response-metadata',
            id: 'parked-response',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
          });
          controller.enqueue({ type: 'text-start', id: 'text-1' });
          started();
          abortSignal?.addEventListener(
            'abort',
            () => {
              observedAbort = true;
              controller.enqueue({ type: 'text-end', id: 'text-1' });
              controller.close();
            },
            { once: true },
          );
        },
      }),
    }),
  });

  return { model, startedPromise, observedAbort: () => observedAbort };
}

function createControllableModel() {
  const runs = Array.from({ length: 2 }, () => {
    let started!: () => void;
    const startedPromise = new Promise<void>(resolve => {
      started = resolve;
    });
    let finish!: () => void;
    let observedAbort = false;

    return {
      started,
      startedPromise,
      setFinish: (callback: () => void) => {
        finish = callback;
      },
      finish: () => finish(),
      observeAbort: () => {
        observedAbort = true;
      },
      observedAbort: () => observedAbort,
    };
  });
  let runIndex = 0;

  const model = new MockLanguageModelV2({
    doStream: async ({ abortSignal }) => {
      const run = runs[runIndex++]!;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: new ReadableStream({
          start(controller) {
            let finished = false;
            const finish = () => {
              if (finished) return;
              finished = true;
              controller.enqueue({ type: 'text-end', id: 'text-1' });
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            };
            run.setFinish(finish);
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: `controllable-response-${runIndex}`,
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            });
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            run.started();
            abortSignal?.addEventListener(
              'abort',
              () => {
                run.observeAbort();
                finish();
              },
              { once: true },
            );
          },
        }),
      };
    },
  });

  return { model, runs };
}

async function abortParkedRun(agent: Agent, runId: string, streamOptions: Parameters<Agent['stream']>[1] = {}) {
  const stream = await agent.stream('hello', { ...streamOptions, runId });
  const text = stream.text;
  return { stream, text };
}

describe('Agent.abortRunStream without a thread', () => {
  it.each([
    { withMemory: false, withThread: false },
    { withMemory: true, withThread: false },
    { withMemory: false, withThread: true },
    { withMemory: true, withThread: true },
  ])('aborts plain streams with memory=$withMemory and thread=$withThread', async ({ withMemory, withThread }) => {
    const { model, startedPromise, observedAbort } = createParkedModel();
    const agent = new Agent({
      id: `plain-${withMemory}-${withThread}`,
      name: 'Plain abort test',
      instructions: 'Test',
      model,
      ...(withMemory ? { memory: new MockMemory() } : {}),
    });
    const runId = `plain-run-${withMemory}-${withThread}`;
    const { stream, text } = await abortParkedRun(
      agent,
      runId,
      withThread ? { memory: { thread: 'thread-1', resource: 'resource-1' } } : {},
    );

    await startedPromise;
    expect(agent.abortRunStream(runId)).toBe(true);
    await text;
    await stream._waitUntilFinished();
    await Promise.resolve();

    expect(observedAbort()).toBe(true);
    expect(agent.abortRunStream(runId)).toBe(false);
  });

  it('aborts streamUntilIdle without a thread', async () => {
    const mastra = new Mastra({ logger: false, storage: new MockStore(), backgroundTasks: { enabled: true } });
    await mastra.startEventEngine();
    const { model, startedPromise, observedAbort } = createParkedModel();
    const agent = new Agent({
      id: 'until-idle-no-thread',
      name: 'Until idle abort test',
      instructions: 'Test',
      model,
      memory: new MockMemory(),
      mastra,
    });
    const runId = 'until-idle-no-thread-run';

    try {
      const { stream, text } = await abortParkedRun(agent, runId, { untilIdle: true });
      await startedPromise;
      expect(agent.abortRunStream(runId)).toBe(true);
      await text;
      await stream._waitUntilFinished();
      await Promise.resolve();

      expect(observedAbort()).toBe(true);
      expect(agent.abortRunStream(runId)).toBe(false);
    } finally {
      await mastra.backgroundTaskManager?.shutdown();
      await mastra.stopEventEngine();
    }
  });

  it('aborts a thread-less run through a cross-agent control topic', async () => {
    const pubsub = new EventEmitterPubSub();
    const { model, startedPromise, observedAbort } = createParkedModel();
    const agent = new Agent({
      id: 'cross-agent-no-thread',
      name: 'Cross-agent abort test',
      instructions: 'Test',
      model,
      pubsub,
    });
    const runId = 'cross-agent-no-thread-run';
    const scope = { threadId: 'control-thread', resourceId: 'control-resource' };
    const follower = new AgentThreadStreamRuntime();
    const remoteSubscription = await follower.subscribeToThread(agent, scope, pubsub);
    const remoteIterator = remoteSubscription.stream[Symbol.asyncIterator]();
    const firstRemotePart = remoteIterator.next();
    const { stream, text } = await abortParkedRun(agent, runId);

    try {
      await startedPromise;
      await agentThreadStreamRuntime.registerRun(
        agent,
        stream,
        { runId, memory: { thread: scope.threadId, resource: scope.resourceId } },
        pubsub,
      );
      await firstRemotePart;
      expect(remoteSubscription.activeRunId()).toBe(runId);
      expect(remoteSubscription.abort()).toBe(true);
      await text;
      await stream._waitUntilFinished();

      expect(observedAbort()).toBe(true);
    } finally {
      remoteSubscription.unsubscribe();
    }
  });

  it('does not let an earlier duplicate run ID clean up a newer thread-less run', async () => {
    const { model, runs } = createControllableModel();
    const agent = new Agent({
      id: 'duplicate-run-id-no-thread',
      name: 'Duplicate run ID cleanup test',
      instructions: 'Test',
      model,
    });
    const runId = 'duplicate-threadless-run';

    const firstStream = await agent.stream('first', { runId });
    const firstText = firstStream.text;
    await runs[0]!.startedPromise;
    const secondStream = await agent.stream('second', { runId });
    const secondText = secondStream.text;
    await runs[1]!.startedPromise;

    runs[0]!.finish();
    await firstText;
    await firstStream._waitUntilFinished();
    await Promise.resolve();

    expect(agent.abortRunStream(runId)).toBe(true);
    await secondText;
    await secondStream._waitUntilFinished();
    expect(runs[1]!.observedAbort()).toBe(true);
  });

  it('removes a thread-less prepared run when its unconsumed output is collected', async () => {
    // Isolate forced garbage collection so the test suite does not need to run with --expose-gc.
    const fixture = new URL('./fixtures/threadless-unconsumed-run-gc.ts', import.meta.url);
    const child = fork(fixture, {
      execArgv: ['--expose-gc', '--import', import.meta.resolve('tsx')],
      silent: true,
    });
    const stderr: Buffer[] = [];
    child.stderr?.on('data', chunk => stderr.push(chunk));
    let completed = false;
    child.on('message', message => {
      if (message === 'ok') completed = true;
    });

    const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      const timeout = setTimeout(() => child.kill('SIGKILL'), 10_000);
      child.once('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once('close', (code, signal) => {
        clearTimeout(timeout);
        resolve({ code, signal });
      });
    });

    const diagnostics = Buffer.concat(stderr).toString() || 'child produced no stderr';
    expect({ ...result, completed }, diagnostics).toEqual({ code: 0, signal: null, completed: true });
  }, 20_000);

  it('removes a thread-less prepared run after it finishes', async () => {
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: 'finished-response',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            });
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'done' });
            controller.enqueue({ type: 'text-end', id: 'text-1' });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            });
            controller.close();
          },
        }),
      }),
    });
    const agent = new Agent({ id: 'finished-no-thread', name: 'Finished cleanup test', instructions: 'Test', model });
    const runId = 'finished-no-thread-run';
    const stream = await agent.stream('hello', { runId });

    await stream.text;
    await stream._waitUntilFinished();
    await Promise.resolve();

    expect(agent.abortRunStream(runId)).toBe(false);
  });
});
