import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../agent';
import { prepareForDurableExecution } from '../../../agent/durable/preparation';
import { createTool } from '../../../tools';
import type { ToolCallConcurrency } from '../../types';
import { EagerToolExecutionCoordinator, eagerToolCallDidNotExecute } from './eager-tool-execution';

type Recorder = {
  events: string[];
  record: (event: string) => void;
};

function createRecorder(): Recorder {
  const events: string[] = [];
  return { events, record: event => events.push(event) };
}

/**
 * A model that emits one complete `tool-call` per entry, pauses so an eager
 * dispatch has a window to be observed, then emits trailing text and `finish`.
 */
function createToolCallModel(
  calls: Array<{ toolCallId: string; toolName: string; input: unknown }>,
  record: Recorder['record'],
) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: new ReadableStream({
        async start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({
            type: 'response-metadata',
            id: 'response-1',
            modelId: 'mock-model',
            timestamp: new Date(0),
          });

          for (const call of calls) {
            record(`complete-${call.toolCallId}`);
            controller.enqueue({
              type: 'tool-call',
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              input: JSON.stringify(call.input),
            });
          }

          await new Promise(resolve => setTimeout(resolve, 100));

          record('later-output');
          controller.enqueue({ type: 'text-start', id: 'text-1' });
          controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'later' });
          controller.enqueue({ type: 'text-end', id: 'text-1' });
          record('finish');
          controller.enqueue({
            type: 'finish',
            finishReason: 'tool-calls',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          });
          controller.close();
        },
      }),
    }),
  });
}

async function drain(stream: { fullStream: AsyncIterable<{ type: string; payload?: any }> }) {
  const chunks: Array<{ type: string; payload?: any }> = [];
  for await (const chunk of stream.fullStream) {
    chunks.push(chunk);
  }
  return chunks;
}

describe('eager tool dispatch — excluded tool classes', () => {
  it('does not eagerly execute a tool that requires approval', async () => {
    const { events, record } = createRecorder();
    const model = createToolCallModel([{ toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } }], record);

    const agent = new Agent({
      id: 'eager-approval-agent',
      name: 'Eager approval agent',
      instructions: 'Call tool-a once.',
      model,
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Requires approval',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          requireApproval: true,
          onInputAvailable: async () => record('input-available-a'),
          execute: async ({ value }) => {
            record('execute-a');
            return { value };
          },
        }),
      },
    });

    const chunks = await drain(
      await agent.stream('go', { maxSteps: 1, eagerToolExecution: true } as Record<string, unknown> as any),
    );

    // Stronger than "it did not execute": `onInputAvailable` fires inside toolCallStep
    // *before* the approval gate is consulted, so an eager dispatch would show up here
    // even though the tool body never ran. Its absence proves dispatch never happened.
    expect(events.slice(0, 3)).toEqual(['complete-call-a', 'later-output', 'finish']);
    const finishIndex = events.indexOf('finish');
    expect(events.indexOf('input-available-a')).toBeGreaterThan(finishIndex);
    // The approval gate is reached, so the body never runs at all.
    expect(events.indexOf('execute-a')).toBe(-1);
    // Existing approval behaviour is preserved end to end: the run asks for approval
    // rather than erroring out of a half-started eager execution.
    expect(chunks.map(chunk => chunk.type)).toContain('tool-call-approval');
    expect(chunks.filter(chunk => chunk.type === 'error')).toEqual([]);
  });

  it('does not eagerly execute a suspendable tool', async () => {
    const { events, record } = createRecorder();
    const model = createToolCallModel([{ toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } }], record);

    const agent = new Agent({
      id: 'eager-suspend-agent',
      name: 'Eager suspend agent',
      instructions: 'Call tool-a once.',
      model,
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Suspendable',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          suspendSchema: z.object({ reason: z.string() }),
          resumeSchema: z.object({ value: z.string() }),
          onInputAvailable: async () => record('input-available-a'),
          execute: async ({ value }) => {
            record('execute-a');
            return { value };
          },
        }),
      },
    });

    await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: true } as Record<string, unknown> as any));

    // Dispatch itself must not happen — see the approval case for why
    // `onInputAvailable` is the discriminating signal.
    const finishIndex = events.indexOf('finish');
    for (const event of ['input-available-a', 'execute-a']) {
      const index = events.indexOf(event);
      expect(index === -1 || index > finishIndex).toBe(true);
    }
  });

  it('does not eagerly execute an agent-derived tool, which can suspend without a suspend schema', async () => {
    const { events, record } = createRecorder();
    const model = createToolCallModel(
      [{ toolCallId: 'call-a', toolName: 'agent-helper', input: { value: 'a' } }],
      record,
    );

    const agent = new Agent({
      id: 'eager-agent-tool-agent',
      name: 'Eager agent-tool agent',
      instructions: 'Call the sub-agent once.',
      model,
      tools: {
        // Named with the `agent-` prefix the runtime itself uses to identify resumable
        // sub-agent tools (see tools/tool-builder/builder.ts isResumableTool).
        'agent-helper': createTool({
          id: 'agent-helper',
          description: 'Stands in for a sub-agent tool',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          onInputAvailable: async () => record('input-available-a'),
          execute: async ({ value }) => {
            record('execute-a');
            return { value };
          },
        }),
      },
    });

    await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: true } as Record<string, unknown> as any));

    const finishIndex = events.indexOf('finish');
    expect(finishIndex).toBeGreaterThan(-1);
    for (const event of ['input-available-a', 'execute-a']) {
      const index = events.indexOf(event);
      expect(index === -1 || index > finishIndex).toBe(true);
    }
  });

  it('does not eagerly execute when the call is dispatched as a background task', async () => {
    const { events, record } = createRecorder();
    const model = createToolCallModel(
      [{ toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a', _background: true } }],
      record,
    );

    const agent = new Agent({
      id: 'eager-background-agent',
      name: 'Eager background agent',
      instructions: 'Call tool-a once.',
      model,
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Background dispatched',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          onInputAvailable: async () => record('input-available-a'),
          execute: async ({ value }) => {
            record('execute-a');
            return { value };
          },
        }),
      },
    });

    await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: true } as Record<string, unknown> as any));

    const finishIndex = events.indexOf('finish');
    for (const event of ['input-available-a', 'execute-a']) {
      const index = events.indexOf(event);
      expect(index === -1 || index > finishIndex).toBe(true);
    }
  });
});

describe('eager tool dispatch — entry points', () => {
  it('leaves regular generate() on the normal path when the option is set', async () => {
    const { events, record } = createRecorder();
    const model = new MockLanguageModelV2({
      doGenerate: async () => {
        record('generate');
        return {
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: 'call-a',
              toolName: 'tool-a',
              input: JSON.stringify({ value: 'a' }),
            },
          ],
          warnings: [],
        };
      },
    });

    const agent = new Agent({
      id: 'eager-generate-agent',
      name: 'Eager generate agent',
      instructions: 'Call tool-a once.',
      model,
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Plain tool',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => {
            record('execute-a');
            return { value };
          },
        }),
      },
    });

    await agent.generate('go', { maxSteps: 1, eagerToolExecution: true } as Record<string, unknown> as any);

    // Honest limitation: generate() resolves through `doGenerate`, so there is no
    // chunk-level window in which an eager dispatch could happen even without the
    // `methodType === 'stream'` gate in createAgenticExecutionWorkflow. What this does
    // prove is that carrying the option on the shared options type neither enables a
    // second execution nor breaks the generate path.
    expect(events).toEqual(['generate', 'execute-a']);
  });
});

describe('eager tool dispatch — concurrency', () => {
  function createConcurrencyAgent(record: Recorder['record'], peak: { current: number; max: number }) {
    const model = createToolCallModel(
      [
        { toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } },
        { toolCallId: 'call-b', toolName: 'tool-a', input: { value: 'b' } },
      ],
      record,
    );

    return new Agent({
      id: 'eager-concurrency-agent',
      name: 'Eager concurrency agent',
      instructions: 'Call tool-a twice.',
      model,
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Tracks peak concurrency',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => {
            peak.current++;
            peak.max = Math.max(peak.max, peak.current);
            await new Promise(resolve => setTimeout(resolve, 20));
            peak.current--;
            record(`execute-${value}`);
            return { value };
          },
        }),
      },
    });
  }

  it('honours a concurrency limit of 1 for eager executions', async () => {
    const { record } = createRecorder();
    const peak = { current: 0, max: 0 };
    const agent = createConcurrencyAgent(record, peak);

    await drain(
      await agent.stream('go', {
        maxSteps: 1,
        eagerToolExecution: true,
        toolCallConcurrency: 1,
      } as Record<string, unknown> as any),
    );

    expect(peak.max).toBe(1);
  });

  it('allows parallel eager executions up to the configured limit', async () => {
    const { record } = createRecorder();
    const peak = { current: 0, max: 0 };
    const agent = createConcurrencyAgent(record, peak);

    await drain(
      await agent.stream('go', {
        maxSteps: 1,
        eagerToolExecution: true,
        toolCallConcurrency: 2,
      } as Record<string, unknown> as any),
    );

    expect(peak.max).toBe(2);
  });

  it('defers to the normal foreach when the "called" strategy is configured', async () => {
    const { events, record } = createRecorder();
    const model = createToolCallModel([{ toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } }], record);

    const agent = new Agent({
      id: 'eager-called-strategy-agent',
      name: 'Eager called strategy agent',
      instructions: 'Call tool-a once.',
      model,
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Records execution',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => {
            record('execute-a');
            return { value };
          },
        }),
      },
    });

    await drain(
      await agent.stream('go', {
        maxSteps: 1,
        eagerToolExecution: true,
        toolCallConcurrency: { limit: 4, strategy: 'called' } satisfies ToolCallConcurrency,
      } as Record<string, unknown> as any),
    );

    // The full called set is unknowable while streaming, so the 'called' strategy
    // keeps its existing post-finish semantics.
    expect(events).toEqual(['complete-call-a', 'later-output', 'finish', 'execute-a']);
  });
});

describe('eager tool dispatch — ordering and exactly-once', () => {
  it('preserves model-call order when executions settle in reverse', async () => {
    const { record } = createRecorder();
    const executionCounts = new Map<string, number>();
    const model = createToolCallModel(
      [
        { toolCallId: 'call-a', toolName: 'slow', input: { value: 'a' } },
        { toolCallId: 'call-b', toolName: 'fast', input: { value: 'b' } },
      ],
      record,
    );

    const makeTool = (id: string, delay: number) =>
      createTool({
        id,
        description: id,
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ value: z.string() }),
        execute: async ({ value }) => {
          executionCounts.set(value, (executionCounts.get(value) ?? 0) + 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          return { value };
        },
      });

    const agent = new Agent({
      id: 'eager-ordering-agent',
      name: 'Eager ordering agent',
      instructions: 'Call both tools.',
      model,
      tools: { slow: makeTool('slow', 60), fast: makeTool('fast', 1) },
    });

    const chunks = await drain(
      await agent.stream('go', {
        maxSteps: 1,
        eagerToolExecution: true,
        toolCallConcurrency: 2,
      } as Record<string, unknown> as any),
    );

    const resultIds = chunks.filter(chunk => chunk.type === 'tool-result').map(chunk => chunk.payload.toolCallId);

    // "fast" settles first, but the foreach remains the owner of result order.
    expect(resultIds).toEqual(['call-a', 'call-b']);
    // Each call executed exactly once — adopted, never re-run by the foreach.
    expect([...executionCounts.entries()].sort()).toEqual([
      ['a', 1],
      ['b', 1],
    ]);
  });

  it('does not run eager work in parallel when an approval-capable tool joins the step', async () => {
    const { record } = createRecorder();
    const peak = { current: 0, max: 0 };
    const model = createToolCallModel(
      [
        { toolCallId: 'call-a', toolName: 'safe-a', input: { value: 'a' } },
        { toolCallId: 'call-b', toolName: 'safe-b', input: { value: 'b' } },
      ],
      record,
    );

    const tracked = (id: string) =>
      createTool({
        id,
        description: 'Tracks peak concurrency',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ value: z.string() }),
        execute: async ({ value }) => {
          peak.current++;
          peak.max = Math.max(peak.max, peak.current);
          await new Promise(resolve => setTimeout(resolve, 20));
          peak.current--;
          return { value };
        },
      });

    const safeTools = { 'safe-a': tracked('safe-a'), 'safe-b': tracked('safe-b') };
    const gated = createTool({
      id: 'gated',
      description: 'Requires approval',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      requireApproval: true,
      execute: async ({ value }) => ({ value }),
    });

    const agent = new Agent({
      id: 'eager-mixed-batch-agent',
      name: 'Eager mixed batch agent',
      instructions: 'Call the tools.',
      model,
      // The agent's own tool set is entirely safe, so the concurrency resolved when the
      // workflow is built is the configured 5.
      tools: safeTools,
    });

    await drain(
      await agent.stream('go', {
        maxSteps: 1,
        eagerToolExecution: true,
        toolCallConcurrency: 5,
        // The approval-capable tool only enters at step level, which is exactly when
        // llm-execution recomputes the foreach limit down to 1. A coordinator holding a
        // construction-time copy of the limit would still run the two safe calls in
        // parallel; reading the limit late keeps one source of truth.
        prepareStep: () => ({ tools: { ...safeTools, gated } }),
      } as Record<string, unknown> as any),
    );

    expect(peak.max).toBe(1);
  });
});

describe('eager tool dispatch — unsafe terminations', () => {
  it('drops eager work that has not started when the model terminates unsafely', async () => {
    const { events, record } = createRecorder();
    // Two calls, limit 1: the first occupies the permit, the second is queued.
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: new ReadableStream({
          async start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: 'response-1',
              modelId: 'mock-model',
              timestamp: new Date(0),
            });
            for (const id of ['call-a', 'call-b']) {
              record(`complete-${id}`);
              controller.enqueue({
                type: 'tool-call',
                toolCallId: id,
                toolName: 'tool-a',
                input: JSON.stringify({ value: id }),
              });
            }
            await new Promise(resolve => setTimeout(resolve, 60));
            record('finish');
            controller.enqueue({
              // Truncated output: the turn must not spawn new tool work.
              type: 'finish',
              finishReason: 'length',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            });
            controller.close();
          },
        }),
      }),
    });

    const agent = new Agent({
      id: 'eager-terminal-agent',
      name: 'Eager terminal agent',
      instructions: 'Call tool-a twice.',
      model,
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Slow tool',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => {
            record(`execute-${value}`);
            // Long enough to still hold the single permit when the model terminates.
            await new Promise(resolve => setTimeout(resolve, 200));
            return { value };
          },
        }),
      },
    });

    await drain(
      await agent.stream('go', {
        maxSteps: 1,
        eagerToolExecution: true,
        toolCallConcurrency: 1,
      } as Record<string, unknown> as any),
    );

    const finishIndex = events.indexOf('finish');
    // The first call was already running and is still adopted — a real side effect is
    // never discarded. The queued one never started eagerly.
    expect(events.indexOf('execute-call-a')).toBeLessThan(finishIndex);
    const secondIndex = events.indexOf('execute-call-b');
    expect(secondIndex === -1 || secondIndex > finishIndex).toBe(true);
  });
});

describe('eager tool dispatch — discarded model attempt', () => {
  /**
   * A model that emits a tool call and then fails mid-stream has its whole attempt
   * discarded: the request is retried on the next model, and the normal pipeline never
   * executes that attempt's tool calls.
   *
   * Eager dispatch cannot fully match that — by the time the model fails, the tool has
   * already started, and no amount of bookkeeping un-runs a side effect. What it can do,
   * and must, is cancel: the discarded attempt's eager work is aborted immediately, so a
   * tool that honours its abort signal stops, and nothing it produced is adopted. This is
   * the documented cost of opting in.
   */
  async function runFallbackScenario(eagerToolExecution: boolean) {
    const { events, record } = createRecorder();

    const failing = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: new ReadableStream({
          async start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: 'response-1',
              modelId: 'failing-model',
              timestamp: new Date(0),
            });
            controller.enqueue({
              type: 'tool-call',
              toolCallId: 'call-discarded',
              toolName: 'tool-a',
              input: JSON.stringify({ value: 'discarded' }),
            });
            await new Promise(resolve => setTimeout(resolve, 20));
            controller.error(new Error('model blew up mid-stream'));
          },
        }),
      }),
    });

    const recovering = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: 'response-2',
              modelId: 'recovering-model',
              timestamp: new Date(0),
            });
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'recovered' });
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

    const agent = new Agent({
      id: `eager-fallback-agent-${eagerToolExecution}`,
      name: 'Eager fallback agent',
      instructions: 'Call tool-a.',
      model: [
        { model: failing, maxRetries: 0 },
        { model: recovering, maxRetries: 0 },
      ] as any,
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Records that it ran',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: async ({ value }, options) => {
            record(`execute-${value}`);
            const signal = (options as { abortSignal?: AbortSignal } | undefined)?.abortSignal;
            await new Promise(resolve => setTimeout(resolve, 60));
            if (signal?.aborted) record(`aborted-${value}`);
            return { value };
          },
        }),
      },
    });

    await drain(
      await agent.stream('go', {
        maxSteps: 1,
        eagerToolExecution,
        toolCallConcurrency: 1,
      } as Record<string, unknown> as any),
    ).catch(() => {});

    // Give any leaked eager execution time to surface rather than racing the assertion.
    await new Promise(resolve => setTimeout(resolve, 50));
    return events.filter(event => event.startsWith('execute-') || event.startsWith('aborted-'));
  }

  it('cancels eager work belonging to an attempt the pipeline discarded', async () => {
    const withoutEager = await runFallbackScenario(false);
    const withEager = await runFallbackScenario(true);

    // The normal pipeline never runs the discarded attempt's call at all.
    expect(withoutEager).toEqual([]);
    // Eager dispatch had already started it, so the guarantee is cancellation, not
    // absence: the tool is told to stop the moment the attempt is thrown away.
    expect(withEager).toEqual(['execute-discarded', 'aborted-discarded']);
  });
});

describe('EagerToolExecutionCoordinator', () => {
  it('never starts queued work after stop(), and marks it as not executed', async () => {
    const coordinator = new EagerToolExecutionCoordinator(() => 1);
    const executed: string[] = [];
    let releaseA: () => void = () => {};
    const aStarted = new Promise<void>(resolve => {
      coordinator.start('call-a', async () => {
        executed.push('a');
        resolve();
        await new Promise<void>(done => (releaseA = done));
        return 'a';
      });
    });

    await aStarted;
    coordinator.start('call-b', async () => {
      executed.push('b');
      return 'b';
    });

    const queued = coordinator.take('call-b')!;
    coordinator.stop();
    releaseA();

    await expect(queued).rejects.toSatisfy(eagerToolCallDidNotExecute);
    // The entry is dropped so the normal foreach path owns the call again.
    expect(coordinator.take('call-b')).toBeUndefined();
    expect(executed).toEqual(['a']);
  });

  it('dispatches a given toolCallId at most once', async () => {
    const coordinator = new EagerToolExecutionCoordinator(() => 4);
    let runs = 0;
    const execute = async () => {
      runs++;
      return 'ok';
    };

    expect(coordinator.start('call-a', execute)).toBe(true);
    expect(coordinator.start('call-a', execute)).toBe(false);
    await coordinator.take('call-a');

    expect(runs).toBe(1);
  });

  it('forgets an execution once it is adopted, so a reused id runs again', async () => {
    const coordinator = new EagerToolExecutionCoordinator(() => 4);
    let runs = 0;
    const execute = async () => `run-${++runs}`;

    coordinator.start('call-a', execute);
    await expect(coordinator.take('call-a')).resolves.toBe('run-1');
    // Same id in a later iteration: the settled result must not be replayed.
    expect(coordinator.take('call-a')).toBeUndefined();
    expect(coordinator.start('call-a', execute)).toBe(true);
    await expect(coordinator.take('call-a')).resolves.toBe('run-2');
  });

  it('reads the concurrency limit late, so a recomputed limit applies', async () => {
    let limit = 4;
    const coordinator = new EagerToolExecutionCoordinator(() => limit);
    const started: string[] = [];
    const hold = () => new Promise<string>(() => {});

    coordinator.start('a', async () => {
      started.push('a');
      return hold();
    });
    // The step recomputes the limit down to 1 (an approval-capable tool joined the step).
    limit = 1;
    coordinator.start('b', async () => {
      started.push('b');
      return hold();
    });

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(started).toEqual(['a']);
    expect(coordinator.running).toBe(1);
  });
});

describe('eager tool dispatch — cancellation', () => {
  it('stops dispatching queued eager work once the caller aborts', async () => {
    const { record } = createRecorder();
    const executed: string[] = [];
    const abortController = new AbortController();

    const model = createToolCallModel(
      [
        { toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } },
        { toolCallId: 'call-b', toolName: 'tool-a', input: { value: 'b' } },
      ],
      record,
    );

    const agent = new Agent({
      id: 'eager-abort-agent',
      name: 'Eager abort agent',
      instructions: 'Call tool-a twice.',
      model,
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Aborts the run from inside the first execution',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => {
            executed.push(value);
            if (value === 'a') {
              abortController.abort();
              await new Promise(resolve => setTimeout(resolve, 20));
            }
            return { value };
          },
        }),
      },
    });

    try {
      await drain(
        await agent.stream('go', {
          maxSteps: 1,
          eagerToolExecution: true,
          // Limit 1 keeps call-b queued while call-a is running, so the abort lands
          // before it is ever dispatched.
          toolCallConcurrency: 1,
          abortSignal: abortController.signal,
        } as Record<string, unknown> as any),
      );
    } catch {
      // An aborted run may surface as a stream error; the assertion below is about
      // whether the queued tool ever ran.
    }

    expect(executed).toEqual(['a']);
  });
});

describe('eager tool dispatch — durable boundary', () => {
  it('rejects the option during durable preparation, before any side effects', async () => {
    let modelCalled = false;
    let toolExecuted = false;

    const agent = new Agent({
      id: 'eager-durable-agent',
      name: 'Eager durable agent',
      instructions: 'Call tool-a once.',
      model: new MockLanguageModelV2({
        doStream: async () => {
          modelCalled = true;
          throw new Error('model should not be called');
        },
      }),
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Should never run',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => {
            toolExecuted = true;
            return { value };
          },
        }),
      },
    });

    await expect(
      prepareForDurableExecution({
        agent,
        messages: 'go',
        options: { eagerToolExecution: true } as Record<string, unknown> as any,
      }),
    ).rejects.toThrow(/eagerToolExecution is not supported by durable agents/);

    expect(modelCalled).toBe(false);
    expect(toolExecuted).toBe(false);
  });

  it('leaves durable preparation unchanged when the option is omitted or false', async () => {
    const agent = new Agent({
      id: 'eager-durable-agent-off',
      name: 'Eager durable agent off',
      instructions: 'Say hi.',
      model: new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            start(controller) {
              controller.close();
            },
          }),
        }),
      }),
    });

    await expect(prepareForDurableExecution({ agent, messages: 'go', options: {} as any })).resolves.toBeDefined();
    await expect(
      prepareForDurableExecution({
        agent,
        messages: 'go',
        options: { eagerToolExecution: false } as Record<string, unknown> as any,
      }),
    ).resolves.toBeDefined();
  });
});
