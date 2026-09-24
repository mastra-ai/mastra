import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../agent';
import { Mastra } from '../../../mastra';
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

function createAgent(model: MockLanguageModelV2, executions: string[], opts: { delayMs?: number; retry?: boolean }) {
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
              processAPIError: async ({ retryCount }: { retryCount: number }) => ({ retry: retryCount < 1 }),
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
          if (opts.delayMs) await new Promise(resolve => setTimeout(resolve, opts.delayMs));
          return { answer: `answered-${value}` };
        },
      }),
    },
  });
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
  it('runs an in-flight call once when the last model dies mid-stream with no retry', async () => {
    // Terminal error: no retry and no fallback, so the pipeline still runs this attempt's
    // calls. Cancelling the eager execution there only makes the foreach start it again.
    const executions: string[] = [];
    const model = new MockLanguageModelV2({
      doStream: async () =>
        toolCallThen(async controller => {
          await new Promise(resolve => setTimeout(resolve, 10));
          controller.error(new Error('provider died mid-stream'));
        }),
    });

    const stream = await createAgent(model, executions, { delayMs: 60 }).stream('go', {
      maxSteps: 1,
      eagerToolExecution: true,
    });
    await drain(stream);
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(executions).toEqual(['a']);
  });

  it('keeps a settled result when a retry is requested but no replacement attempt runs', async () => {
    const executions: string[] = [];
    let attempts = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        attempts += 1;
        return toolCallThen(async controller => {
          await new Promise(resolve => setTimeout(resolve, 40));
          controller.enqueue({ type: 'error', error: new Error('transient provider failure') });
          controller.close();
        });
      },
    });

    const stream = await createAgent(model, executions, { retry: true }).stream('go', {
      maxSteps: 1,
      eagerToolExecution: true,
    });
    await drain(stream);
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(attempts).toBe(1);
    expect(executions).toEqual(['a']);
    expect(recordedResults(stream)).toContain('answered-a');
  });

  it('applies the configured payload transform to a settled result it writes on discard', async () => {
    const executions: string[] = [];
    const model = new MockLanguageModelV2({
      doStream: async () =>
        toolCallThen(async controller => {
          await new Promise(resolve => setTimeout(resolve, 40));
          controller.enqueue({ type: 'error', error: new Error('transient provider failure') });
          controller.close();
        }),
    });

    const stream = await createAgent(model, executions, { retry: true }).stream('go', {
      maxSteps: 1,
      eagerToolExecution: true,
      transform: {
        targets: ['transcript'],
        transformToolPayload: ctx => `[redacted ${ctx.phase}]`,
      },
    } as never);
    await drain(stream);
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(executions).toEqual(['a']);
    expect(recordedResults(stream)).toContain('[redacted output-available]');
  });

  it('commits a settled result when the caller aborts, and still runs it only once', async () => {
    const executions: string[] = [];
    const abortController = new AbortController();
    const model = new MockLanguageModelV2({
      doStream: async ({ abortSignal }) =>
        toolCallThen(async controller => {
          // The call settles, then the stream stalls until the caller gives up.
          await new Promise(resolve => setTimeout(resolve, 40));
          abortController.abort();
          await new Promise<void>(resolve => {
            if (abortSignal?.aborted) return resolve();
            abortSignal?.addEventListener('abort', () => resolve(), { once: true });
            setTimeout(resolve, 200);
          });
          controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        }),
    });

    const stream = await createAgent(model, executions, {}).stream('go', {
      maxSteps: 2,
      eagerToolExecution: true,
      abortSignal: abortController.signal,
    });
    await drain(stream);
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(executions).toEqual(['a']);
    expect(recordedResults(stream)).toContain('answered-a');
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
    let attempts = 0;
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        attempts += 1;
        prompts.push(prompt);
        if (attempts > 1) return textOnly();
        return toolCallThen(async controller => {
          await new Promise(resolve => setTimeout(resolve, 40));
          controller.enqueue({ type: 'error', error: new Error('transient provider failure') });
          controller.close();
        });
      },
    });

    const stream = await createAgent(model, executions, { retry: true }).stream('go', {
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

  it('never repeats pre-suspend work when a suspended eager attempt is retried', async () => {
    // A tool that suspends at runtime without a suspendSchema: its eager attempt has already
    // done the pre-suspend work. Retrying the model must not start that body again.
    const effects: string[] = [];
    let attempts = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        attempts += 1;
        return toolCallThen(async controller => {
          await new Promise(resolve => setTimeout(resolve, 40));
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
              await options?.agent?.suspend?.({ reason: 'needs input' });
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
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(attempts).toBe(1);
    expect(types).toContain('tool-call-suspended');
    expect(effects).toEqual(['pre-a']);
  });
});
