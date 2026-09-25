import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../agent';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { EagerToolExecutionCoordinator } from './eager-tool-execution';

/**
 * The two rules eager dispatch has to hold on every path that ends an attempt early:
 * a tool that already ran is never run a second time, and its finished result is
 * never thrown away.
 */

type StreamPart = Record<string, unknown>;

function toolCallThen(
  after: (controller: ReadableStreamDefaultController<StreamPart>) => Promise<void>,
  calls: Array<{ toolCallId: string; value: string }> = [{ toolCallId: 'call-a', value: 'a' }],
) {
  return {
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
    stream: new ReadableStream<StreamPart>({
      async start(controller) {
        controller.enqueue({ type: 'stream-start', warnings: [] });
        controller.enqueue({
          type: 'response-metadata',
          id: 'response',
          modelId: 'mock-model',
          timestamp: new Date(0),
        });
        for (const call of calls) {
          controller.enqueue({
            type: 'tool-call',
            toolCallId: call.toolCallId,
            toolName: 'tool-a',
            input: JSON.stringify({ value: call.value }),
          });
        }
        await after(controller);
      },
    }),
  };
}

function textOnly() {
  return {
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
    stream: new ReadableStream<StreamPart>({
      start(controller) {
        controller.enqueue({ type: 'stream-start', warnings: [] });
        controller.enqueue({ type: 'text-start', id: 't' });
        controller.enqueue({ type: 'text-delta', id: 't', delta: 'done' });
        controller.enqueue({ type: 'text-end', id: 't' });
        controller.enqueue({
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        });
        controller.close();
      },
    }),
  };
}

function createAgent(
  model: MockLanguageModelV2,
  executions: string[],
  opts: {
    started?: ReturnType<typeof deferred>;
    release?: Promise<void>;
    settled?: ReturnType<typeof deferred>;
    retry?: boolean;
    gate?: ReturnType<typeof inFlightGate>;
    onAPIError?: () => void;
  },
) {
  return new Agent({
    id: 'eager-settled-work-agent',
    name: 'Eager settled work agent',
    instructions: 'Call tool-a.',
    model,
    ...(opts.retry
      ? {
          errorProcessors: [
            {
              id: 'retry-once',
              processAPIError: async ({ retryCount }: { retryCount: number }) => {
                opts.onAPIError?.();
                return { retry: retryCount < 1 };
              },
            },
          ] as never,
        }
      : {}),
    tools: {
      'tool-a': createTool({
        id: 'tool-a',
        description: 'Records every time its body runs',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ answer: z.string() }),
        execute: async ({ value }) => {
          executions.push(value);
          if (opts.gate) return opts.gate.hold(() => ({ answer: `answered-${value}` }));
          opts.started?.resolve();
          await opts.release;
          opts.settled?.resolve();
          return { answer: `answered-${value}` };
        },
      }),
    },
  });
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => (resolve = r));
  return { promise, resolve };
}

/**
 * Holds a tool body open until its attempt has failed, so in-flight scenarios need no
 * wall-clock sleeps. `started` lets the model fail only once the tool is running; the
 * body is released when the pipeline starts waiting out running work (a build that
 * cancels instead never waits, and the test releases it after the run); `settled`
 * resolves once the body has returned or thrown. `onWait` replaces the release, to
 * act at the moment the pipeline starts waiting.
 */
function inFlightGate(opts: { onWait?: () => void } = {}) {
  const started = deferred();
  const release = deferred();
  const settled = deferred();
  const settleRunning = EagerToolExecutionCoordinator.prototype.settleRunning as
    | ((this: EagerToolExecutionCoordinator, signal?: AbortSignal) => Promise<void>)
    | undefined;
  if (settleRunning) {
    vi.spyOn(EagerToolExecutionCoordinator.prototype, 'settleRunning').mockImplementation(function (
      this: EagerToolExecutionCoordinator,
      signal?: AbortSignal,
    ) {
      if (opts.onWait) opts.onWait();
      else release.resolve();
      return settleRunning.call(this, signal);
    });
  }
  return {
    started: started.promise,
    settled: settled.promise,
    release: release.resolve,
    async hold<T>(body: () => T): Promise<Awaited<T>> {
      started.resolve();
      try {
        await release.promise;
        return await body();
      } finally {
        settled.resolve();
      }
    },
  };
}

async function drain(stream: { fullStream: AsyncIterable<unknown> }) {
  try {
    for await (const _ of stream.fullStream) {
      // drain
    }
  } catch {
    // terminal errors are part of these scenarios
  }
}

function recordedResults(stream: { messageList: { get: { all: { db: () => unknown[] } } } }) {
  return JSON.stringify(stream.messageList.get.all.db());
}

describe('eager tool dispatch — finished work survives every early exit', () => {
  afterEach(() => vi.restoreAllMocks());

  it('runs an in-flight call once when the last model dies mid-stream with no retry', async () => {
    // Terminal error: no retry and no fallback, so the pipeline still runs this attempt's
    // calls. Cancelling the eager execution there only makes the foreach start it again.
    const executions: string[] = [];
    const started = deferred();
    const release = deferred();
    const settled = deferred();
    const model = new MockLanguageModelV2({
      doStream: async () =>
        toolCallThen(async controller => {
          // The model dies while the call is still running.
          await started.promise;
          controller.error(new Error('provider died mid-stream'));
          release.resolve();
        }),
    });

    const stream = await createAgent(model, executions, { started, release: release.promise, settled }).stream('go', {
      maxSteps: 1,
      eagerToolExecution: true,
    });
    await drain(stream);
    await settled.promise;

    expect(executions).toEqual(['a']);
  });

  it('keeps a settled result when a retry is requested but no replacement attempt runs', async () => {
    const executions: string[] = [];
    const settled = deferred();
    let attempts = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        attempts += 1;
        return toolCallThen(async controller => {
          await settled.promise;
          controller.enqueue({ type: 'error', error: new Error('transient provider failure') });
          controller.close();
        });
      },
    });

    const stream = await createAgent(model, executions, { retry: true, settled }).stream('go', {
      maxSteps: 1,
      eagerToolExecution: true,
    });
    await drain(stream);

    expect(attempts).toBe(1);
    expect(executions).toEqual(['a']);
    expect(recordedResults(stream)).toContain('answered-a');
  });

  it('applies the configured payload transform to a settled result it writes on discard', async () => {
    const executions: string[] = [];
    const settled = deferred();
    const model = new MockLanguageModelV2({
      doStream: async () =>
        toolCallThen(async controller => {
          await settled.promise;
          controller.enqueue({ type: 'error', error: new Error('transient provider failure') });
          controller.close();
        }),
    });

    const stream = await createAgent(model, executions, { retry: true, settled }).stream('go', {
      maxSteps: 1,
      eagerToolExecution: true,
      transform: {
        targets: ['transcript'],
        transformToolPayload: ctx => `[redacted ${ctx.phase}]`,
      },
    } as never);
    await drain(stream);

    expect(executions).toEqual(['a']);
    expect(recordedResults(stream)).toContain('[redacted output-available]');
  });

  it('commits a settled result when the caller aborts, and still runs it only once', async () => {
    const executions: string[] = [];
    const abortController = new AbortController();
    const settled = deferred();
    const model = new MockLanguageModelV2({
      doStream: async ({ abortSignal }) =>
        toolCallThen(async controller => {
          // The call settles, then the stream stalls until the caller gives up.
          await settled.promise;
          abortController.abort();
          await new Promise<void>(resolve => {
            if (abortSignal?.aborted) return resolve();
            abortSignal?.addEventListener('abort', () => resolve(), { once: true });
          });
          controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        }),
    });

    const stream = await createAgent(model, executions, { settled }).stream('go', {
      maxSteps: 2,
      eagerToolExecution: true,
      abortSignal: abortController.signal,
    });
    await drain(stream);

    expect(executions).toEqual(['a']);
    expect(recordedResults(stream)).toContain('answered-a');
  });

  it('waits out a running call when the caller aborts mid-stream, then keeps its result', async () => {
    // Same order as the post-stream pass: a started tool is waited for whether or not it
    // observes its signal, its result is streamed and recorded, and only then `abort`.
    const executions: string[] = [];
    const abortController = new AbortController();
    const started = deferred();
    const release = deferred();
    const agent = new Agent({
      id: 'eager-abort-agent',
      name: 'Eager abort agent',
      instructions: 'Call tool-a.',
      model: new MockLanguageModelV2({
        doStream: async ({ abortSignal }) =>
          toolCallThen(async controller => {
            await started.promise;
            abortController.abort();
            await new Promise<void>(resolve => {
              if (abortSignal?.aborted) return resolve();
              abortSignal?.addEventListener('abort', () => resolve(), { once: true });
            });
            controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' }));
            // Still running, ignoring its signal, when the stream dies; finishes after.
            release.resolve();
          }),
      }),
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Ignores its abort signal',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ answer: z.string() }),
          execute: async ({ value }) => {
            executions.push(value);
            started.resolve();
            await release.promise;
            return { answer: `answered-${value}` };
          },
        }),
      },
    });

    const stream = await agent.stream('go', {
      maxSteps: 2,
      eagerToolExecution: true,
      abortSignal: abortController.signal,
    });
    const types: string[] = [];
    try {
      for await (const chunk of stream.fullStream) types.push((chunk as { type: string }).type);
    } catch {
      // abort ends the stream
    }

    expect(executions).toEqual(['a']);
    expect(types).toContain('tool-result');
    expect(types.indexOf('tool-result')).toBeLessThan(types.indexOf('abort'));
    expect(recordedResults(stream)).toContain('answered-a');
  });

  it('keeps a call that stopped on the abort in the saved thread as incomplete', async () => {
    // The default pipeline leaves a started call that observed the abort in history as
    // incomplete. Eager dispatch must too: the tool ran up to the abort.
    const executions: string[] = [];
    const abortController = new AbortController();
    const started = deferred();
    const memory = new MockMemory();
    const agent = new Agent({
      id: 'eager-abort-incomplete-agent',
      name: 'Eager abort incomplete agent',
      instructions: 'Call tool-a.',
      memory,
      model: new MockLanguageModelV2({
        doStream: async ({ abortSignal }) =>
          toolCallThen(async controller => {
            await started.promise;
            abortController.abort();
            await new Promise<void>(resolve => {
              if (abortSignal?.aborted) return resolve();
              abortSignal?.addEventListener('abort', () => resolve(), { once: true });
            });
            controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          }),
      }),
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Stops when aborted',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ answer: z.string() }),
          execute: async ({ value }, context) => {
            executions.push(value);
            const signal = context?.abortSignal;
            started.resolve();
            await new Promise<void>((_, reject) => {
              const stop = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
              if (signal?.aborted) return stop();
              signal?.addEventListener('abort', stop, { once: true });
            });
            return { answer: 'unreachable' };
          },
        }),
      },
    });

    const stream = await agent.stream('go', {
      maxSteps: 2,
      eagerToolExecution: true,
      abortSignal: abortController.signal,
      memory: { thread: 'thread-abort', resource: 'resource-abort' },
    });
    try {
      for await (const _ of stream.fullStream) {
        // drain
      }
    } catch {
      // abort ends the stream
    }

    expect(executions).toEqual(['a']);
    const { messages } = await memory.recall({ threadId: 'thread-abort', resourceId: 'resource-abort' });
    const saved = JSON.stringify(messages);
    expect(saved).toContain('"toolCallId":"call-a"');
    expect(saved).toContain('"state":"call"');
  });

  it('does not leave abort listeners on a caller signal reused across runs', async () => {
    const executions: string[] = [];
    let turn = 0;
    const model = new MockLanguageModelV2({
      doStream: async () =>
        turn++ % 2 === 0
          ? toolCallThen(async controller => {
              controller.enqueue({
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            })
          : textOnly(),
    });
    const agent = createAgent(model, executions, {});
    const caller = new AbortController();

    for (let run = 0; run < 3; run++) {
      await drain(await agent.stream('go', { maxSteps: 3, eagerToolExecution: true, abortSignal: caller.signal }));
    }
    expect(executions).toEqual(['a', 'a', 'a']);

    // Every run has ended. Aborting the shared signal now must not reach any of them.
    const stop = vi.spyOn(EagerToolExecutionCoordinator.prototype, 'stop');
    try {
      caller.abort();
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(stop.mock.calls.filter(([options]) => options?.permanent)).toHaveLength(0);
    } finally {
      stop.mockRestore();
    }
  });

  it('writes a settled result into the replacement attempt, and runs it once', async () => {
    // Positive control for the retry path the fix reroutes: commit at discard must not
    // double-write when the replacement attempt then starts.
    const executions: string[] = [];
    const prompts: unknown[] = [];
    const settled = deferred();
    let attempts = 0;
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        attempts += 1;
        prompts.push(prompt);
        if (attempts > 1) return textOnly();
        return toolCallThen(async controller => {
          await settled.promise;
          controller.enqueue({ type: 'error', error: new Error('transient provider failure') });
          controller.close();
        });
      },
    });

    const stream = await createAgent(model, executions, { retry: true, settled }).stream('go', {
      maxSteps: 3,
      eagerToolExecution: true,
    });
    await drain(stream);

    expect(attempts).toBe(2);
    expect(executions).toEqual(['a']);
    const retryPrompt = JSON.stringify(prompts[1]);
    expect(retryPrompt).toContain('answered-a');
    expect(retryPrompt.split('"call-a"').length - 1).toBe(2);
  });

  it('lets an in-flight call finish on retry so the replacement never runs it again', async () => {
    // The tool is still running when the first attempt errors and is retried. Cancelling
    // it would let the replacement attempt call it a second time.
    const executions: string[] = [];
    const gate = inFlightGate();
    let attempts = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        attempts += 1;
        if (attempts > 1) return textOnly();
        return toolCallThen(async controller => {
          await gate.started;
          controller.enqueue({ type: 'error', error: new Error('transient provider failure') });
          controller.close();
        });
      },
    });

    const stream = await createAgent(model, executions, { retry: true, gate }).stream('go', {
      maxSteps: 3,
      eagerToolExecution: true,
    });
    await drain(stream);
    gate.release();
    await gate.settled;

    expect(executions).toEqual(['a']);
    expect(recordedResults(stream)).toContain('answered-a');
  });

  it('does not run error processing when the run is aborted while waiting out an in-flight call', async () => {
    const executions: string[] = [];
    const caller = new AbortController();
    // First wait: the caller aborts. Second wait is the abort exit waiting the call out.
    const gate: ReturnType<typeof inFlightGate> = inFlightGate({
      onWait: () => (caller.signal.aborted ? gate.release() : caller.abort()),
    });
    let attempts = 0;
    let apiErrorCalls = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        attempts += 1;
        if (attempts > 1) return textOnly();
        return toolCallThen(async controller => {
          await gate.started;
          controller.enqueue({ type: 'error', error: new Error('transient provider failure') });
          controller.close();
        });
      },
    });

    const stream = await createAgent(model, executions, {
      retry: true,
      gate,
      onAPIError: () => apiErrorCalls++,
    }).stream('go', {
      maxSteps: 3,
      eagerToolExecution: true,
      abortSignal: caller.signal,
    });
    const types: string[] = [];
    try {
      for await (const c of stream.fullStream as AsyncIterable<{ type: string }>) types.push(c.type);
    } catch {}
    gate.release();
    await gate.settled;

    // The abort ends the wait, so no error processor may act on the dead attempt.
    expect(apiErrorCalls).toBe(0);
    expect(types).toContain('abort');
    expect(types.indexOf('tool-result')).toBeGreaterThan(-1);
    expect(types.indexOf('tool-result')).toBeLessThan(types.indexOf('abort'));
    expect(attempts).toBe(1);
    expect(executions).toEqual(['a']);
  });

  it('lets an in-flight call finish on fallback so the fallback model never runs it again', async () => {
    // Falling over to the next model throws out of the stream rather than returning a retry,
    // so it reaches a different early exit than the retry case above.
    const executions: string[] = [];
    const gate = inFlightGate();
    const failing = new MockLanguageModelV2({
      modelId: 'failing-model',
      doStream: async () =>
        toolCallThen(async controller => {
          await gate.started;
          controller.error(new Error('provider died mid-stream'));
        }),
    });
    const fallback = new MockLanguageModelV2({ modelId: 'fallback-model', doStream: async () => textOnly() });
    const agent = createAgent(failing, executions, { gate });
    agent.__updateModel({
      model: [
        { model: failing, maxRetries: 0 },
        { model: fallback, maxRetries: 0 },
      ] as never,
    });

    const stream = await agent.stream('go', { maxSteps: 3, eagerToolExecution: true });
    await drain(stream);
    gate.release();
    await gate.settled;

    expect(fallback.doStreamCalls.length).toBe(1);
    expect(executions).toEqual(['a']);
    expect(recordedResults(stream)).toContain('answered-a');
  });

  it('keeps the error of an in-flight call that throws while its attempt is retried', async () => {
    const executions: string[] = [];
    const gate = inFlightGate();
    let attempts = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        attempts += 1;
        if (attempts > 1) return textOnly();
        return toolCallThen(async controller => {
          await gate.started;
          controller.enqueue({ type: 'error', error: new Error('transient provider failure') });
          controller.close();
        });
      },
    });
    const agent = new Agent({
      id: 'eager-throwing-retry-agent',
      name: 'Eager throwing retry agent',
      instructions: 'Call tool-a.',
      model,
      errorProcessors: [
        {
          id: 'retry-once',
          processAPIError: async ({ retryCount }: { retryCount: number }) => ({ retry: retryCount < 1 }),
        },
      ] as never,
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Fails after doing its work',
          inputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => {
            executions.push(value);
            return gate.hold(() => {
              throw new Error(`tool-a exploded on ${value}`);
            });
          },
        }),
      },
    });

    const stream = await agent.stream('go', { maxSteps: 3, eagerToolExecution: true });
    await drain(stream);
    gate.release();
    await gate.settled;

    expect(attempts).toBe(2);
    expect(executions).toEqual(['a']);
    expect(recordedResults(stream)).toContain('tool-a exploded on a');
  });

  it('never repeats pre-suspend work when a suspended eager attempt is retried', async () => {
    // A tool that suspends at runtime without a suspendSchema: its eager attempt has already
    // done the pre-suspend work. Retrying the model must not start that body again.
    const effects: string[] = [];
    const suspended = deferred();
    let attempts = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        attempts += 1;
        return toolCallThen(async controller => {
          // Fail only once the call has suspended; one macrotask lets its rejection land.
          await suspended.promise;
          await new Promise(resolve => setImmediate(resolve));
          if (attempts === 1) {
            controller.enqueue({ type: 'error', error: new Error('transient provider failure') });
          } else {
            controller.enqueue({
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            });
          }
          controller.close();
        });
      },
    });
    const agent = new Agent({
      id: 'eager-suspend-retry-agent',
      name: 'Eager suspend retry agent',
      instructions: 'Call tool-a.',
      model,
      errorProcessors: [
        {
          id: 'retry-once',
          processAPIError: async ({ retryCount }: { retryCount: number }) => ({ retry: retryCount < 1 }),
        },
      ] as never,
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Does work, then suspends at runtime',
          inputSchema: z.object({ value: z.string() }),
          execute: async ({ value }, options?: any) => {
            if (options?.agent?.resumeData === undefined) {
              effects.push(`pre-${value}`);
              try {
                await options?.agent?.suspend?.({ reason: 'needs input' });
              } finally {
                suspended.resolve();
              }
            }
            return { value };
          },
        }),
      },
    });
    new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore() });

    const stream = await agent.stream('go', { maxSteps: 3, eagerToolExecution: true });
    const types: string[] = [];
    for await (const chunk of stream.fullStream) types.push((chunk as { type: string }).type);

    expect(attempts).toBe(1);
    expect(types).toContain('tool-call-suspended');
    expect(effects).toEqual(['pre-a']);
  });
});
