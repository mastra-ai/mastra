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

    // The approval-gated tool must never run ahead of the model's finish; the
    // approval decision itself only exists inside toolCallStep.
    expect(events.indexOf('execute-a')).toBe(-1);
    expect(events).toEqual(['complete-call-a', 'later-output', 'finish']);
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
          execute: async ({ value }) => {
            record('execute-a');
            return { value };
          },
        }),
      },
    });

    await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: true } as Record<string, unknown> as any));

    const executeIndex = events.indexOf('execute-a');
    const finishIndex = events.indexOf('finish');
    expect(executeIndex === -1 || executeIndex > finishIndex).toBe(true);
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
});

describe('EagerToolExecutionCoordinator', () => {
  it('never starts queued work after stop(), and marks it as not executed', async () => {
    const coordinator = new EagerToolExecutionCoordinator(1);
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

    const queued = coordinator.get('call-b')!;
    coordinator.stop();
    releaseA();

    await expect(queued).rejects.toSatisfy(eagerToolCallDidNotExecute);
    // The entry is dropped so the normal foreach path owns the call again.
    expect(coordinator.get('call-b')).toBeUndefined();
    expect(executed).toEqual(['a']);
  });

  it('dispatches a given toolCallId at most once', async () => {
    const coordinator = new EagerToolExecutionCoordinator(4);
    let runs = 0;
    const execute = async () => {
      runs++;
      return 'ok';
    };

    expect(coordinator.start('call-a', execute)).toBe(true);
    expect(coordinator.start('call-a', execute)).toBe(false);
    await coordinator.get('call-a');

    expect(runs).toBe(1);
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
