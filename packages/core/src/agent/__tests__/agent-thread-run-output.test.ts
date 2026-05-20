import { describe, expect, it, vi } from 'vitest';

import type { MastraModelOutput } from '../../stream/base/output';
import { Agent } from '../agent';
import type { AgentExecutionOptions } from '../agent.types';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';

function createOutput(runId: string): { output: MastraModelOutput; finish: () => void } {
  let status: 'running' | 'finished' = 'running';
  let resolveFinished!: () => void;
  const finished = new Promise<void>(resolve => {
    resolveFinished = resolve;
  });

  const output = {
    runId,
    get status() {
      return status;
    },
    fullStream: new ReadableStream({
      start(controller) {
        controller.close();
      },
    }),
    _waitUntilFinished: async () => finished,
    getFullOutput: async () => ({
      text: 'ok',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      finishReason: 'stop',
      object: undefined,
      steps: [],
      warnings: [],
      providerMetadata: undefined,
      request: {},
      reasoning: [],
      reasoningText: undefined,
      toolCalls: [],
      toolResults: [],
      sources: [],
      files: [],
      response: { id: 'response-id', timestamp: new Date(0), modelId: 'mock-model', messages: [], uiMessages: [] },
      totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      error: undefined,
      tripwire: undefined,
      traceId: undefined,
      spanId: undefined,
      runId,
      suspendPayload: undefined,
      messages: [],
      rememberedMessages: [],
    }),
  } as unknown as MastraModelOutput;

  return {
    output,
    finish: () => {
      status = 'finished';
      resolveFinished();
    },
  };
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    if (condition()) return;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  expect(condition()).toBe(true);
}

class SignalRunAgent extends Agent<any, any, any> {
  lastMessages: unknown;
  lastOptions: AgentExecutionOptions | undefined;
  streamError?: Error;

  constructor() {
    super({
      id: 'signal-run-agent',
      name: 'Signal Run Agent',
      instructions: 'test',
      model: 'openai/gpt-4o-mini' as any,
    });
  }

  async stream(messages: any, options?: any): Promise<any> {
    this.lastMessages = messages;
    this.lastOptions = options;
    if (this.streamError) {
      throw this.streamError;
    }
    const runId = options?.runId ?? 'missing-run-id';
    const { output } = createOutput(runId);
    this._internalRegisterStreamRun(output, options);
    return output;
  }
}

describe('agent thread run output lookup', () => {
  it('resolves waiters when a run output is registered and clears the lookup after finish', async () => {
    const agent = new SignalRunAgent();
    const pending = agent.waitForRunOutput('run-1');
    const { output, finish } = createOutput('run-1');

    agent._internalRegisterStreamRun(output, {
      memory: { thread: 'thread-1', resource: 'resource-1' },
    } as AgentExecutionOptions);

    await expect(pending).resolves.toBe(output);
    expect(agent.getRunOutput('run-1')).toBe(output);

    finish();
    await waitFor(() => agent.getRunOutput('run-1') === undefined);
  });

  it('exposes the output for a signal-started idle run', async () => {
    const agent = new SignalRunAgent();

    const dispatched = agent.sendSignal(
      { type: 'user-message', contents: 'hello' },
      {
        resourceId: 'resource-2',
        threadId: 'thread-2',
        ifIdle: {
          streamOptions: {
            memory: { thread: 'thread-2', resource: 'resource-2' },
          },
        },
      },
    );

    const output = await agent.waitForRunOutput(dispatched.runId);

    expect(output.runId).toBe(dispatched.runId);
    expect(agent.getRunOutput(dispatched.runId)).toBe(output);
    expect(agent.lastMessages).toMatchObject({
      type: 'user-message',
      contents: 'hello',
    });
    expect(agent.lastOptions).toMatchObject({
      runId: dispatched.runId,
      memory: { thread: 'thread-2', resource: 'resource-2' },
    });
  });

  it('rejects waiters when a signal-started idle run fails before registering output', async () => {
    const runtime = new AgentThreadStreamRuntime();
    let rejectStream!: (error: Error) => void;
    const stream = vi.fn(
      () =>
        new Promise((_resolve, reject) => {
          rejectStream = reject;
        }),
    );

    const dispatched = runtime.sendSignal(
      { id: 'failing-idle-agent', stream } as any,
      { type: 'user-message', contents: 'hello' },
      {
        resourceId: 'resource-3',
        threadId: 'thread-3',
        ifIdle: {
          streamOptions: {
            memory: { thread: 'thread-3', resource: 'resource-3' },
          },
        },
      },
    );

    const waiter = runtime.waitForRunOutput(dispatched.runId);
    rejectStream(new Error('idle stream failed'));

    await expect(waiter).rejects.toThrow('idle stream failed');
    await expect(runtime.waitForRunOutput(dispatched.runId)).rejects.toThrow('idle stream failed');
  });

  it('allows waiters to be aborted without consuming later registration', async () => {
    const agent = new SignalRunAgent();
    const abortController = new AbortController();

    const waiter = agent.waitForRunOutput('run-abortable', { abortSignal: abortController.signal });
    abortController.abort(new Error('stop waiting'));

    await expect(waiter).rejects.toThrow('stop waiting');

    const { output } = createOutput('run-abortable');
    agent._internalRegisterStreamRun(output, {
      memory: { thread: 'thread-4', resource: 'resource-4' },
    } as AgentExecutionOptions);

    await expect(agent.waitForRunOutput('run-abortable')).resolves.toBe(output);
  });

  it('rejects waiters when a run is aborted before it is prepared', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const waiter = runtime.waitForRunOutput('unprepared-run');

    expect(runtime.abortRun('unprepared-run')).toBe(false);

    await expect(waiter).rejects.toThrow('has been aborted');
    await expect(runtime.waitForRunOutput('unprepared-run')).rejects.toThrow('has been aborted');
  });
});
