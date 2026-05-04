import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';

import { Mastra } from '../../mastra';
import { Agent } from '../agent';
import {
  createSignal,
  dataPartToSignal,
  mastraDBMessageToSignal,
  signalToDataPartFormat,
  signalToMastraDBMessage,
} from '../signals';

function createTextStreamModel(responseText: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
    }),
  });
}

function nextTick() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('Agent signals', () => {
  it('converts signals between DB, LLM, and data part formats', () => {
    const signal = createSignal({
      id: 'signal-1',
      type: 'user-message',
      contents: 'Signal contents',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: { source: 'test' },
    });

    expect(signal.toLLMMessage()).toBe('Signal contents');
    expect(signal.toDataPart()).toEqual({
      type: 'data-user-message',
      data: {
        id: 'signal-1',
        type: 'user-message',
        contents: 'Signal contents',
        createdAt: '2026-01-01T00:00:00.000Z',
        metadata: { source: 'test' },
      },
    });

    const dbMessage = signal.toDBMessage({ threadId: 'thread-1', resourceId: 'resource-1' });
    expect(dbMessage.role).toBe('signal');
    expect(signalToMastraDBMessage(signal).role).toBe('signal');
    expect(mastraDBMessageToSignal(dbMessage).contents).toBe('Signal contents');
    expect(dataPartToSignal(signalToDataPartFormat(signal)).contents).toBe('Signal contents');

    const reminderSignal = createSignal({
      id: 'signal-2',
      type: 'system-reminder',
      contents: 'Use <safe> content & continue',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      attributes: { type: 'dynamic-agents-md', path: '/tmp/AGENTS.md', enabled: true, ignored: null },
    });

    expect(reminderSignal.toLLMMessage()).toEqual([
      {
        role: 'system',
        content:
          '<system-reminder type="dynamic-agents-md" path="/tmp/AGENTS.md" enabled="true">Use &lt;safe&gt; content &amp; continue</system-reminder>',
      },
    ]);
    expect(reminderSignal.toDataPart().data.attributes).toEqual({
      type: 'dynamic-agents-md',
      path: '/tmp/AGENTS.md',
      enabled: true,
      ignored: null,
    });
    expect(mastraDBMessageToSignal(reminderSignal.toDBMessage()).attributes).toEqual({
      type: 'dynamic-agents-md',
      path: '/tmp/AGENTS.md',
      enabled: true,
      ignored: null,
    });
  });

  it('subscribes to a future thread run', async () => {
    const agent = new Agent({
      id: 'future-thread-agent',
      name: 'Future Thread Agent',
      instructions: 'Test',
      model: createTextStreamModel('future response'),
    });

    const subscription = await agent.subscribeToThread({
      threadId: 'future-thread',
      resourceId: 'future-user',
    });
    const nextRun = subscription.runs[Symbol.asyncIterator]().next();

    const stream = await agent.stream('Hello', {
      memory: { thread: 'future-thread', resource: 'future-user' },
    });

    const subscribedRun = await nextRun;
    expect(subscribedRun.value.runId).toBe(stream.runId);
    await expect(subscribedRun.value.output.text).resolves.toBe('future response');

    subscription.cleanup();
  });

  it('starts an idle thread run when a user-message signal is sent', async () => {
    const agent = new Agent({
      id: 'idle-signal-agent',
      name: 'Idle Signal Agent',
      instructions: 'Test',
      model: createTextStreamModel('signal response'),
    });

    const subscription = await agent.subscribeToThread({
      threadId: 'idle-thread',
      resourceId: 'idle-user',
    });
    const nextRun = subscription.runs[Symbol.asyncIterator]().next();

    const signalResult = agent.sendSignal(
      { type: 'user-message', contents: 'Hello from signal' },
      { resourceId: 'idle-user', threadId: 'idle-thread' },
    );

    const subscribedRun = await nextRun;
    expect(signalResult).toEqual({ accepted: true, runId: subscribedRun.value.runId });
    await expect(subscribedRun.value.output.text).resolves.toBe('signal response');

    subscription.cleanup();
  });

  it('supports cross-instance thread subscriptions through the Mastra runtime', async () => {
    const runner = new Agent({
      id: 'shared-agent',
      name: 'Shared Runner Agent',
      instructions: 'Test',
      model: createTextStreamModel('shared response'),
    });
    const observer = new Agent({
      id: 'shared-agent',
      name: 'Shared Observer Agent',
      instructions: 'Test',
      model: createTextStreamModel('observer response'),
    });
    new Mastra({ agents: { runner, observer }, logger: false });

    const subscription = await observer.subscribeToThread({
      threadId: 'shared-thread',
      resourceId: 'shared-user',
    });
    const iterator = subscription.runs[Symbol.asyncIterator]();
    const firstRunPromise = iterator.next();

    const stream = await runner.stream('Hello', {
      memory: { thread: 'shared-thread', resource: 'shared-user' },
    });

    const subscribedRun = await firstRunPromise;
    expect(subscribedRun.value.runId).toBe(stream.runId);
    await expect(subscribedRun.value.output.text).resolves.toBe('shared response');

    const secondRunPromise = iterator.next();
    const signalResult = runner.sendSignal(
      { type: 'user-message', contents: 'Hello from shared signal' },
      { resourceId: 'shared-user', threadId: 'shared-thread' },
    );
    const signalRun = await secondRunPromise;
    expect(signalResult).toEqual({ accepted: true, runId: signalRun.value.runId });
    await expect(signalRun.value.output.text).resolves.toBe('shared response');

    subscription.cleanup();
  });

  it('queues a user-message signal while a thread run is active', async () => {
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let streamCount = 0;

    const model = new MockLanguageModelV2({
      doStream: async () => {
        streamCount += 1;
        const responseText = streamCount === 1 ? 'first response' : 'signal response';

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: `id-${streamCount}`,
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              });
              controller.enqueue({ type: 'text-start', id: 'text-1' });
              controller.enqueue({ type: 'text-delta', id: 'text-1', delta: responseText });
              controller.enqueue({ type: 'text-end', id: 'text-1' });
              if (streamCount === 1) {
                await firstFinished;
              }
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        };
      },
    });

    const agent = new Agent({
      id: 'active-signal-agent',
      name: 'Active Signal Agent',
      instructions: 'Test',
      model,
    });

    const subscription = await agent.subscribeToThread({
      threadId: 'active-thread',
      resourceId: 'active-user',
    });
    const iterator = subscription.runs[Symbol.asyncIterator]();
    const firstRunPromise = iterator.next();

    const stream = await agent.stream('Hello', {
      memory: { thread: 'active-thread', resource: 'active-user' },
    });
    const firstRun = await firstRunPromise;

    const signalResult = agent.sendSignal(
      { type: 'user-message', contents: 'Hello while running' },
      { resourceId: 'active-user', threadId: 'active-thread' },
    );
    expect(signalResult).toEqual({ accepted: true, runId: stream.runId });

    releaseFirst();
    await expect(firstRun.value.output.text).resolves.toBe('first response');

    const secondRun = await iterator.next();
    expect(secondRun.value.runId).not.toBe(stream.runId);
    await expect(secondRun.value.output.text).resolves.toBe('signal response');

    subscription.cleanup();
  });

  it('queues a signal from another agent until the active thread run finishes', async () => {
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let firstStarted = false;
    let secondStarted = false;

    const firstAgent = new Agent({
      id: 'cross-agent-a',
      name: 'Cross Agent A',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async () => {
          firstStarted = true;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: new ReadableStream({
              async start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({
                  type: 'response-metadata',
                  id: 'cross-a',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                });
                controller.enqueue({ type: 'text-start', id: 'text-1' });
                controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'first response' });
                controller.enqueue({ type: 'text-end', id: 'text-1' });
                await firstFinished;
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
                controller.close();
              },
            }),
          };
        },
      }),
    });
    const secondAgent = new Agent({
      id: 'cross-agent-b',
      name: 'Cross Agent B',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async () => {
          secondStarted = true;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'cross-b', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'second response' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
          };
        },
      }),
    });
    new Mastra({ agents: { firstAgent, secondAgent }, logger: false });

    const subscription = await firstAgent.subscribeToThread({
      threadId: 'cross-agent-thread',
      resourceId: 'cross-agent-user',
    });
    const iterator = subscription.runs[Symbol.asyncIterator]();
    const firstRunPromise = iterator.next();

    const firstStream = await firstAgent.stream('Hello', {
      memory: { thread: 'cross-agent-thread', resource: 'cross-agent-user' },
    });
    await firstRunPromise;
    const firstText = firstStream.text;
    await nextTick();
    expect(firstStarted).toBe(true);

    const secondRunPromise = iterator.next();
    const signalResult = secondAgent.sendSignal(
      { type: 'user-message', contents: 'Hello from another agent' },
      { resourceId: 'cross-agent-user', threadId: 'cross-agent-thread' },
    );
    await nextTick();
    expect(secondStarted).toBe(false);

    releaseFirst();
    await expect(firstText).resolves.toBe('first response');

    const secondRun = await secondRunPromise;
    expect(secondRun.value.runId).toBe(signalResult.runId);
    await expect(secondRun.value.output.text).resolves.toBe('second response');
    expect(secondStarted).toBe(true);

    subscription.cleanup();
  });

  it('cleans up a thread subscription and completes the iterator', async () => {
    const agent = new Agent({
      id: 'cleanup-signal-agent',
      name: 'Cleanup Signal Agent',
      instructions: 'Test',
      model: createTextStreamModel('cleanup response'),
    });

    const subscription = await agent.subscribeToThread({
      threadId: 'cleanup-thread',
      resourceId: 'cleanup-user',
    });
    const iterator = subscription.runs[Symbol.asyncIterator]();

    subscription.cleanup();
    await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
  });

  it('delivers a future thread run to multiple subscribers', async () => {
    const agent = new Agent({
      id: 'multiple-subscriber-agent',
      name: 'Multiple Subscriber Agent',
      instructions: 'Test',
      model: createTextStreamModel('multi response'),
    });

    const firstSubscription = await agent.subscribeToThread({
      threadId: 'multi-thread',
      resourceId: 'multi-user',
    });
    const secondSubscription = await agent.subscribeToThread({
      threadId: 'multi-thread',
      resourceId: 'multi-user',
    });
    const firstRunPromise = firstSubscription.runs[Symbol.asyncIterator]().next();
    const secondRunPromise = secondSubscription.runs[Symbol.asyncIterator]().next();

    const stream = await agent.stream('Hello', {
      memory: { thread: 'multi-thread', resource: 'multi-user' },
    });

    await expect(firstRunPromise).resolves.toMatchObject({ value: { runId: stream.runId }, done: false });
    await expect(secondRunPromise).resolves.toMatchObject({ value: { runId: stream.runId }, done: false });

    firstSubscription.cleanup();
    secondSubscription.cleanup();
  });

  it('isolates subscriptions by resource and thread id', async () => {
    const agent = new Agent({
      id: 'isolated-signal-agent',
      name: 'Isolated Signal Agent',
      instructions: 'Test',
      model: createTextStreamModel('isolated response'),
    });

    const targetSubscription = await agent.subscribeToThread({
      threadId: 'isolated-thread',
      resourceId: 'isolated-user',
    });
    const otherResourceSubscription = await agent.subscribeToThread({
      threadId: 'isolated-thread',
      resourceId: 'other-user',
    });
    const otherThreadSubscription = await agent.subscribeToThread({
      threadId: 'other-thread',
      resourceId: 'isolated-user',
    });

    const targetNext = targetSubscription.runs[Symbol.asyncIterator]().next();
    const otherResourceNext = otherResourceSubscription.runs[Symbol.asyncIterator]().next();
    const otherThreadNext = otherThreadSubscription.runs[Symbol.asyncIterator]().next();

    const stream = await agent.stream('Hello', {
      memory: { thread: 'isolated-thread', resource: 'isolated-user' },
    });

    await expect(targetNext).resolves.toMatchObject({ value: { runId: stream.runId }, done: false });
    await nextTick();

    otherResourceSubscription.cleanup();
    otherThreadSubscription.cleanup();
    await expect(otherResourceNext).resolves.toEqual({ value: undefined, done: true });
    await expect(otherThreadNext).resolves.toEqual({ value: undefined, done: true });

    targetSubscription.cleanup();
  });

  it('does not replay existing thread runs to late subscribers', async () => {
    const agent = new Agent({
      id: 'late-subscription-agent',
      name: 'Late Subscription Agent',
      instructions: 'Test',
      model: createTextStreamModel('late response'),
    });

    await agent.stream('Hello', {
      memory: { thread: 'late-thread', resource: 'late-user' },
    });
    const subscription = await agent.subscribeToThread({
      threadId: 'late-thread',
      resourceId: 'late-user',
    });
    const iterator = subscription.runs[Symbol.asyncIterator]();

    const nextRun = iterator.next();
    await nextTick();
    subscription.cleanup();
    await expect(nextRun).resolves.toEqual({ value: undefined, done: true });
  });

  it('queues a signal by active run id', async () => {
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let streamCount = 0;

    const model = new MockLanguageModelV2({
      doStream: async () => {
        streamCount += 1;
        const responseText = streamCount === 1 ? 'run id first response' : 'run id signal response';

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: `run-id-${streamCount}`,
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              });
              controller.enqueue({ type: 'text-start', id: 'text-1' });
              controller.enqueue({ type: 'text-delta', id: 'text-1', delta: responseText });
              controller.enqueue({ type: 'text-end', id: 'text-1' });
              if (streamCount === 1) {
                await firstFinished;
              }
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        };
      },
    });

    const agent = new Agent({
      id: 'run-id-signal-agent',
      name: 'Run Id Signal Agent',
      instructions: 'Test',
      model,
    });
    const subscription = await agent.subscribeToThread({
      threadId: 'run-id-thread',
      resourceId: 'run-id-user',
    });
    const iterator = subscription.runs[Symbol.asyncIterator]();
    const firstRunPromise = iterator.next();

    const stream = await agent.stream('Hello', {
      memory: { thread: 'run-id-thread', resource: 'run-id-user' },
    });
    await firstRunPromise;

    expect(agent.sendSignal({ type: 'user-message', contents: 'Hello by run id' }, { runId: stream.runId })).toEqual({
      accepted: true,
      runId: stream.runId,
    });

    releaseFirst();
    await expect(iterator.next()).resolves.toMatchObject({
      value: { threadId: 'run-id-thread', resourceId: 'run-id-user' },
      done: false,
    });

    subscription.cleanup();
  });

  it('throws when sending a signal to an unknown run id without a thread target', () => {
    const agent = new Agent({
      id: 'missing-run-signal-agent',
      name: 'Missing Run Signal Agent',
      instructions: 'Test',
      model: createTextStreamModel('missing run response'),
    });

    expect(() => agent.sendSignal({ type: 'user-message', contents: 'Hello' }, { runId: 'missing-run-id' })).toThrow(
      'No active agent run found for signal target',
    );
  });

  it('starts an idle thread run with a system-reminder signal as a system prompt message', async () => {
    let capturedPrompt: any[] | undefined;
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        capturedPrompt = prompt;
        return {
          rawCall: { rawPrompt: prompt, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'system-signal-id', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'system signal response' },
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
      id: 'system-signal-agent',
      name: 'System Signal Agent',
      instructions: 'Test',
      model,
    });

    const stream = agent.sendSignal(
      { type: 'system-reminder', contents: 'continue', attributes: { reminderType: 'test-reminder' } },
      { resourceId: 'system-signal-user', threadId: 'system-signal-thread' },
    );

    expect(stream.accepted).toBe(true);
    await nextTick();
    expect(
      capturedPrompt?.some(
        message =>
          message.role === 'system' &&
          message.content === '<system-reminder reminderType="test-reminder">continue</system-reminder>',
      ),
    ).toBe(true);
  });
});
