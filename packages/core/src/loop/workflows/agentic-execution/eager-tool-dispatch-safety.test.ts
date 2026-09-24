import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../agent';
import { prepareForDurableExecution } from '../../../agent/durable/preparation';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import type { ToolCallConcurrency } from '../../types';
import {
  EagerToolExecutionCoordinator,
  EagerToolExecutionNotRun,
  eagerToolCallDidNotExecute,
  eagerToolCallSuspensionIntent,
} from './eager-tool-execution';
import type { EagerToolBailout } from './eager-tool-execution';

type Recorder = {
  events: string[];
  record: (event: string) => void;
};

/**
 * Per-iteration suspend state lives at `__workflow_meta.foreachOutput` on the suspending
 * step's context entry, so find the step that actually suspended rather than hard-coding
 * the tool-call step's id.
 */
function findForeachOutputWithSuspension(snapshot: any): any[] | undefined {
  for (const stepCtx of Object.values(snapshot?.context ?? {}) as any[]) {
    const foreachOutput = stepCtx?.suspendPayload?.__workflow_meta?.foreachOutput;
    if (Array.isArray(foreachOutput) && foreachOutput.some((entry: any) => entry?.suspendPayload)) {
      return foreachOutput;
    }
  }
  return undefined;
}

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
  { finishReason = 'tool-calls', pauseMs = 100 }: { finishReason?: 'tool-calls' | 'length'; pauseMs?: number } = {},
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

          await new Promise(resolve => setTimeout(resolve, pauseMs));

          record('later-output');
          controller.enqueue({ type: 'text-start', id: 'text-1' });
          controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'later' });
          controller.enqueue({ type: 'text-end', id: 'text-1' });
          record('finish');
          controller.enqueue({
            type: 'finish',
            finishReason,
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          });
          controller.close();
        },
      }),
    }),
  });
}

/**
 * Same model, but it only emits the tool calls on its first stream. A resumed run drives the
 * model again, and a model that re-emits the same call every time would have the tool suspend
 * a second time — a fixture artifact that has nothing to do with eager dispatch.
 */
function createOneShotToolCallModel(
  calls: Array<{ toolCallId: string; toolName: string; input: unknown }>,
  record: Recorder['record'],
) {
  let streams = 0;
  const withCalls = createToolCallModel(calls, record);
  const withoutCalls = createToolCallModel([], record);
  return new MockLanguageModelV2({
    doStream: async (...doStreamArgs: any[]) => {
      streams += 1;
      const delegate: any = streams === 1 ? withCalls : withoutCalls;
      return delegate.doStream(...doStreamArgs);
    },
  });
}

async function drain(stream: { fullStream: AsyncIterable<{ type: string; payload?: any }> }) {
  const chunks: Array<{ type: string; payload?: any }> = [];
  for await (const chunk of stream.fullStream) {
    chunks.push(chunk);
  }
  return chunks;
}

/** Resolves when every eager coordinator the run created has no running work left. */
function trackEagerWork() {
  const coordinators = new Set<EagerToolExecutionCoordinator>();
  const start = EagerToolExecutionCoordinator.prototype.start;
  const spy = vi.spyOn(EagerToolExecutionCoordinator.prototype, 'start').mockImplementation(function (
    this: EagerToolExecutionCoordinator,
    ...args: Parameters<typeof start>
  ) {
    coordinators.add(this);
    return start.apply(this, args);
  });
  return {
    idle: async () => {
      await Promise.all([...coordinators].map(coordinator => coordinator.settleRunning()));
      spy.mockRestore();
    },
  };
}
describe('eager tool dispatch — execution context parity', () => {
  it('hands an eagerly dispatched tool the same context as the deferred path', async () => {
    // The eager dispatch hand-builds the execution context that the foreach would
    // otherwise build for it. Nothing forces the two to agree, so a field added to the
    // deferred path would silently go missing from the eager one. This pins them
    // together: whatever a tool can see when it runs late, it can see when it runs early.
    const seen: Record<string, string[]> = {};

    const run = async (eager: boolean) => {
      const { record } = createRecorder();
      const model = createToolCallModel([{ toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } }], record);
      const agent = new Agent({
        id: `eager-parity-agent-${eager}`,
        name: 'Eager parity agent',
        instructions: 'Call tool-a once.',
        model,
        tools: {
          'tool-a': createTool({
            id: 'tool-a',
            description: 'Reports the context it was given',
            inputSchema: z.object({ value: z.string() }),
            outputSchema: z.object({ value: z.string() }),
            execute: async ({ value }, options) => {
              seen[String(eager)] = Object.keys(options ?? {})
                .filter(key => (options as Record<string, unknown>)[key] !== undefined)
                .sort();
              return { value };
            },
          }),
        },
      });
      await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: eager }));
    };

    await run(false);
    await run(true);

    // Sanity: the deferred path really did populate a context, so an empty-vs-empty
    // comparison cannot pass this by accident.
    expect(seen['false']!.length).toBeGreaterThan(3);
    // Nothing the deferred path provides may be missing from the eager one.
    expect(seen['true']).toEqual(expect.arrayContaining(seen['false']!));
    // The only thing eager adds is the fused abort signal, which is how cancelling an
    // early start reaches a tool that is already running. Any *other* extra field is drift.
    expect(seen['true']!.filter(key => !seen['false']!.includes(key))).toEqual(['abortSignal']);
  });
});

const CALL_A = [{ toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } }];

/** An ordinary eligible server tool that records when it is announced and when it runs. */
function recordingTool(record: Recorder['record'], overrides: Record<string, unknown> = {}, id = 'tool-a') {
  return createTool({
    id,
    description: 'Records its lifecycle',
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    onInputAvailable: async () => record('input-available-a'),
    execute: async ({ value }) => {
      record('execute-a');
      return { value };
    },
    ...overrides,
  } as any);
}

/**
 * How an excluded call may show up relative to the model's `finish`:
 * - `never-dispatched`: neither announced nor run.
 * - `never-executed`: the body never runs (it may be announced after finish).
 * - `later`: it runs, but only on the post-stream pass.
 * - `not-early`: whatever it does happens after finish.
 */
type Exclusion = 'never-dispatched' | 'never-executed' | 'later' | 'not-early';

function expectExcluded(events: string[], exclusion: Exclusion) {
  const finishIndex = events.indexOf('finish');
  expect(finishIndex).toBeGreaterThan(-1);
  for (const event of ['input-available-a', 'execute-a']) {
    const index = events.indexOf(event);
    expect(index === -1 || index > finishIndex).toBe(true);
  }
  if (exclusion === 'never-dispatched') expect(events).not.toContain('input-available-a');
  if (exclusion === 'never-dispatched' || exclusion === 'never-executed') expect(events).not.toContain('execute-a');
  if (exclusion === 'later') expect(events).toContain('execute-a');
}

describe('eager tool dispatch — excluded tool classes', () => {
  it('does not eagerly execute a tool that requires approval', async () => {
    const { events, record } = createRecorder();
    const agent = new Agent({
      id: 'eager-approval-agent',
      name: 'Eager approval agent',
      instructions: 'Call tool-a once.',
      model: createToolCallModel(CALL_A, record),
      tools: { 'tool-a': recordingTool(record, { requireApproval: true }) },
    });

    const chunks = await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: true }));

    // `onInputAvailable` fires inside toolCallStep *before* the approval gate, so an eager
    // dispatch would show up here even though the body never ran.
    expect(events.slice(0, 3)).toEqual(['complete-call-a', 'later-output', 'finish']);
    expectExcluded(events, 'never-executed');
    // The run asks for approval rather than erroring out of a half-started eager execution.
    expect(chunks.map(chunk => chunk.type)).toContain('tool-call-approval');
    expect(chunks.filter(chunk => chunk.type === 'error')).toEqual([]);
  });

  const cases: Array<{
    name: string;
    exclusion: Exclusion;
    toolName?: string;
    input?: Record<string, unknown>;
    tools?: (record: Recorder['record']) => Record<string, any>;
    agentOptions?: Record<string, unknown>;
    streamOptions?: (record: Recorder['record']) => Record<string, unknown>;
    registerWithMastra?: boolean;
    expectEvents?: string[];
  }> = [
    {
      // The tool is eligible; the veto is run-level, a source consulted separately.
      name: 'when approval comes from the run-level policy',
      exclusion: 'never-executed',
      streamOptions: () => ({ requireToolApproval: true }),
    },
    {
      // A predicate is async, so its answer is unknown at dispatch time; unknown means ineligible.
      name: 'a tool whose approval is decided by a predicate',
      exclusion: 'never-executed',
      tools: record => ({ 'tool-a': recordingTool(record, { requireApproval: async () => true }) }),
    },
    {
      name: 'a tool the step has filtered out of activeTools',
      exclusion: 'never-dispatched',
      tools: record => ({ 'tool-a': recordingTool(record), 'tool-b': recordingTool(() => {}, {}, 'tool-b') }),
      streamOptions: () => ({ activeTools: ['tool-b'] }),
    },
    {
      // A post-stream processor can still rewrite or drop the response, so the whole turn waits.
      name: 'when an output processor runs after the stream',
      exclusion: 'later',
      streamOptions: record => ({
        outputProcessors: [
          {
            id: 'post-stream-veto',
            processOutputStep: async () => {
              record('post-stream-processor');
              return [];
            },
          },
        ],
      }),
      expectEvents: ['post-stream-processor'],
    },
    {
      // No `execute`: the call is the caller's to run, so nothing may be announced early.
      name: 'a client-side tool, which has no execute to call',
      exclusion: 'not-early',
      tools: record => ({
        'tool-a': {
          id: 'tool-a',
          description: 'Client-side tool with no execute',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          onInputAvailable: async () => record('input-available-a'),
        } as any,
      }),
    },
    {
      // Any call may be a resume, which is the foreach's to sequence.
      name: 'when the run may auto-resume a suspended tool',
      exclusion: 'later',
      streamOptions: () => ({ autoResumeSuspendedTools: true }),
    },
    {
      name: 'a suspendable tool',
      exclusion: 'not-early',
      tools: record => ({
        'tool-a': recordingTool(record, {
          suspendSchema: z.object({ reason: z.string() }),
          resumeSchema: z.object({ value: z.string() }),
        }),
      }),
    },
    {
      // The `agent-` prefix is what the runtime uses to identify resumable sub-agent tools.
      name: 'an agent-derived tool, which can suspend without a suspend schema',
      exclusion: 'not-early',
      toolName: 'agent-helper',
      tools: record => ({ 'agent-helper': recordingTool(record, {}, 'agent-helper') }),
    },
    {
      // Agent config alone dispatches to the background, with nothing in the call arguments.
      name: 'a call that config alone dispatches to the background',
      exclusion: 'not-early',
      agentOptions: { backgroundTasks: { tools: { 'tool-a': true } } },
      registerWithMastra: true,
    },
    {
      name: 'when the call is dispatched as a background task',
      exclusion: 'not-early',
      input: { value: 'a', _background: true },
    },
  ];

  it.each(cases)('does not eagerly execute $name', async testCase => {
    const { events, record } = createRecorder();
    const toolName = testCase.toolName ?? 'tool-a';
    const agent = new Agent({
      id: 'eager-exclusion-agent',
      name: 'Eager exclusion agent',
      instructions: 'Call the tool once.',
      model: createToolCallModel([{ toolCallId: 'call-a', toolName, input: testCase.input ?? { value: 'a' } }], record),
      tools: testCase.tools?.(record) ?? { 'tool-a': recordingTool(record) },
      ...testCase.agentOptions,
    });
    if (testCase.registerWithMastra) {
      new Mastra({ agents: { 'eager-exclusion-agent': agent }, backgroundTasks: { enabled: true }, logger: false });
    }

    await drain(
      await agent.stream('go', { maxSteps: 1, eagerToolExecution: true, ...testCase.streamOptions?.(record) }),
    );

    for (const event of testCase.expectEvents ?? []) expect(events).toContain(event);
    expectExcluded(events, testCase.exclusion);
  });

  it('does not eagerly execute a provider-executed call', async () => {
    // The provider already ran it; our own copy must never start, early or late.
    const { events, record } = createRecorder();
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: new ReadableStream({
          async start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            record('complete-call-a');
            controller.enqueue({
              type: 'tool-call',
              toolCallId: 'call-a',
              toolName: 'tool-a',
              input: JSON.stringify({ value: 'a' }),
              providerExecuted: true,
            });
            await new Promise(resolve => setTimeout(resolve, 100));
            record('finish');
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
      id: 'eager-provider-executed-agent',
      name: 'Eager provider-executed agent',
      instructions: 'Call tool-a once.',
      model,
      tools: { 'tool-a': recordingTool(record) },
    });

    await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: true }));

    expectExcluded(events, 'never-dispatched');
  });
  it('announces onInputAvailable once when an eager attempt hands the call back', async () => {
    // The hook is announced immediately before `execute`, so a bailout raised from
    // inside the tool body has already fired it. The foreach then adopts that call and
    // raises the real suspension from the carried intent: without a marker travelling
    // with the rejection it would announce the same toolCallId twice, which is one more
    // call than the tool gets with eager dispatch off.
    const run = async (eager: boolean) => {
      const { record, events } = createRecorder();
      let inputAvailable = 0;
      let bodyRuns = 0;
      const model = createToolCallModel([{ toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } }], record);
      const agent = new Agent({
        id: 'eager-input-available-agent',
        name: 'Eager input available agent',
        instructions: 'Call tool-a once.',
        model,
        tools: {
          'tool-a': createTool({
            id: 'tool-a',
            description: 'Suspends at runtime without declaring a suspend schema',
            inputSchema: z.object({ value: z.string() }),
            outputSchema: z.object({ value: z.string() }),
            onInputAvailable: async () => {
              inputAvailable += 1;
            },
            execute: async ({ value }, options?: any) => {
              bodyRuns += 1;
              record('body');
              await options?.agent?.suspend?.({ reason: 'needs input' });
              return { value };
            },
          }),
        },
      });

      const chunks = await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: eager }));
      return { inputAvailable, bodyRuns, events, types: chunks.map(chunk => chunk.type) };
    };

    // Explicitly off: eager is the default, so an omitted option compares eager to itself.
    const base = await run(false);
    const eager = await run(true);

    expect(base.inputAvailable).toBe(1);
    expect(eager.inputAvailable).toBe(base.inputAvailable);
    // The handed-back attempt raises the real suspension itself, so the body is never run
    // a second time: the eager path now matches the non-eager one exactly.
    expect(base.bodyRuns).toBe(1);
    expect(eager.bodyRuns).toBe(base.bodyRuns);
    // Body-run parity no longer proves the call was dispatched eagerly, so prove it
    // separately: only an eager dispatch can start the body before the model stream
    // finishes. Without this the test would still pass if eager dispatch stopped happening.
    expect(eager.events.indexOf('body')).toBeGreaterThanOrEqual(0);
    expect(eager.events.indexOf('body')).toBeLessThan(eager.events.indexOf('finish'));
    expect(base.events.indexOf('body')).toBeGreaterThan(base.events.indexOf('finish'));
    // The handback has to end in a real suspension, not a skipped call.
    expect(eager.types).toEqual(base.types);
    expect(eager.types).toContain('tool-call-suspended');
  });

  it('suspends normally when a tool suspends at runtime without declaring a suspend schema', async () => {
    // The whitelist cannot see this coming: `hasSuspendSchema` is false, so the call is
    // dispatched eagerly and only discovers it suspends once the body runs. The fail-safe
    // has to hand it back to the foreach *before* any suspension side effect, otherwise a
    // suspension is announced on a path that then records an error and never suspends.
    const run = async (eager: boolean) => {
      const { record } = createRecorder();
      const model = createToolCallModel([{ toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } }], record);
      const agent = new Agent({
        id: 'eager-runtime-suspend-agent',
        name: 'Eager runtime suspend agent',
        instructions: 'Call tool-a once.',
        model,
        tools: {
          'tool-a': createTool({
            id: 'tool-a',
            description: 'Suspends at runtime without declaring a suspend schema',
            inputSchema: z.object({ value: z.string() }),
            outputSchema: z.object({ value: z.string() }),
            execute: async ({ value }, options?: any) => {
              await options?.agent?.suspend?.({ reason: 'needs input' });
              return { value };
            },
          }),
        },
      });

      const chunks = await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: eager }));
      return chunks.map(chunk => chunk.type);
    };

    // Explicitly off, not merely defaulted: eager is the default now, so an omitted
    // option would compare the eager path against itself.
    const base = await run(false);
    const eager = await run(true);

    // Suspends cleanly, exactly as it does without the option: no `tool-error`, and no
    // suspension chunk left stranded in front of one.
    expect(eager).toEqual(base);
    expect(eager).toContain('tool-call-suspended');
    expect(eager).not.toContain('tool-error');
  });

  it('suspends normally even when the tool swallows the eager bailout', async () => {
    // Raising "did not run" from the eager `suspend` stub unwinds through the tool's own
    // body, so a tool that wraps its work in try/catch eats it and returns normally. The
    // bailout must survive that: otherwise the step resolves an ordinary-looking envelope
    // and the foreach adopts a result for a call that asked to suspend — the suspension
    // never happens, and the value the tool returned after being denied is recorded as
    // though the call had succeeded.
    const run = async (eager: boolean) => {
      const { record, events } = createRecorder();
      const model = createToolCallModel([{ toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } }], record);
      // `onOutput` is the tool's own "this produced a result" hook. A denied eager attempt
      // must not reach it: the value handed to it belongs to a call that asked to suspend,
      // and the foreach raises that suspension from the carried intent instead.
      let onOutputCalls = 0;
      const agent = new Agent({
        id: 'eager-swallowed-suspend-agent',
        name: 'Eager swallowed suspend agent',
        instructions: 'Call tool-a once.',
        model,
        tools: {
          'tool-a': createTool({
            id: 'tool-a',
            description: 'Suspends at runtime and swallows anything the suspend call throws',
            inputSchema: z.object({ value: z.string() }),
            outputSchema: z.object({ value: z.string() }),
            onOutput: async () => {
              onOutputCalls += 1;
            },
            execute: async ({ value }, options?: any) => {
              record('body');
              try {
                await options?.agent?.suspend?.({ reason: 'needs input' });
              } catch {
                // Exactly the shape that defeats a throw-only bailout.
              }
              return { value };
            },
          }),
        },
      });

      const chunks = await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: eager }));
      return { types: chunks.map(chunk => chunk.type), onOutputCalls, events };
    };

    const base = await run(false);
    const eager = await run(true);

    expect(eager.types).toEqual(base.types);
    expect(eager.types).toContain('tool-call-suspended');
    // Chunk parity alone would still hold if eager dispatch silently stopped happening —
    // the eager run would simply be the base run. Only an eager dispatch starts the body
    // before the model stream finishes, so assert that directly.
    expect(eager.events.indexOf('body')).toBeGreaterThanOrEqual(0);
    expect(eager.events.indexOf('body')).toBeLessThan(eager.events.indexOf('finish'));
    expect(base.events.indexOf('body')).toBeGreaterThan(base.events.indexOf('finish'));
    // The carried suspension intent wins over the value the tool returned after swallowing
    // the bailout: the eager path suspends from that intent and discards the value, so
    // `onOutput` never fires for it. The non-eager path's `suspend()` returns normally, the
    // tool returns, and its hook fires once. The divergence is the fix, not a regression —
    // the swallowed value is exactly what must never be adopted.
    expect(base.onOutputCalls).toBe(1);
    expect(eager.onOutputCalls).toBe(0);
  });

  it('suspends normally when the tool swallows the eager bailout and throws its own error', async () => {
    // The other shape of the same hole: the tool catches the bailout and then fails on its
    // own. That failure belongs to a call that was denied, so it must not be resolved as this
    // call's error result. Adoption would record it and the suspension would never happen.
    const run = async (eager: boolean) => {
      const { record, events } = createRecorder();
      const model = createToolCallModel([{ toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } }], record);
      const agent = new Agent({
        id: 'eager-swallowed-suspend-throw-agent',
        name: 'Eager swallowed suspend throw agent',
        instructions: 'Call tool-a once.',
        model,
        tools: {
          'tool-a': createTool({
            id: 'tool-a',
            description: 'Suspends at runtime, swallows the throw, then throws its own error',
            inputSchema: z.object({ value: z.string() }),
            outputSchema: z.object({ value: z.string() }),
            execute: async (_input, options?: any) => {
              record('body');
              try {
                await options?.agent?.suspend?.({ reason: 'needs input' });
              } catch {
                throw new Error('tool decided to fail instead');
              }
              return { value: 'suspend returned' };
            },
          }),
        },
      });

      const chunks = await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: eager }));
      return { types: chunks.map(chunk => chunk.type), events };
    };

    const base = await run(false);
    const eager = await run(true);

    expect(eager.types).toEqual(base.types);
    expect(eager.types).toContain('tool-call-suspended');
    // Chunk parity alone would also hold if eager dispatch silently stopped happening, so
    // prove the body really started inside the model stream on the eager path only.
    expect(eager.events.indexOf('body')).toBeGreaterThanOrEqual(0);
    expect(eager.events.indexOf('body')).toBeLessThan(eager.events.indexOf('finish'));
    expect(base.events.indexOf('body')).toBeGreaterThan(base.events.indexOf('finish'));
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

    await agent.generate('go', { maxSteps: 1, eagerToolExecution: true });

    // Honest limitation: generate() resolves through `doGenerate`, so there is no
    // chunk-level window in which an eager dispatch could happen even without the
    // `methodType === 'stream'` gate in createAgenticExecutionWorkflow. What this does
    // prove is that carrying the option on the shared options type neither enables a
    // second execution nor breaks the generate path.
    expect(events).toEqual(['generate', 'execute-a']);
  });
});

/** A tool that tracks how many copies of itself are running at once. */
function peakTrackingTool(id: string, peak: { current: number; max: number }, record?: Recorder['record']) {
  return createTool({
    id,
    description: 'Tracks peak concurrency',
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    execute: async ({ value }) => {
      peak.current++;
      peak.max = Math.max(peak.max, peak.current);
      await new Promise(resolve => setTimeout(resolve, 20));
      peak.current--;
      record?.(`execute-${value}`);
      return { value };
    },
  });
}

describe('eager tool dispatch — concurrency', () => {
  it.each([1, 2])('caps eager executions at a concurrency limit of %i', async limit => {
    const { record } = createRecorder();
    const peak = { current: 0, max: 0 };
    const agent = new Agent({
      id: 'eager-concurrency-agent',
      name: 'Eager concurrency agent',
      instructions: 'Call tool-a twice.',
      model: createToolCallModel(
        [
          { toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } },
          { toolCallId: 'call-b', toolName: 'tool-a', input: { value: 'b' } },
        ],
        record,
      ),
      tools: { 'tool-a': peakTrackingTool('tool-a', peak, record) },
    });

    await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: true, toolCallConcurrency: limit }));

    expect(peak.max).toBe(limit);
  });

  it('defers to the normal foreach when the "called" strategy is configured', async () => {
    const { events, record } = createRecorder();
    const agent = new Agent({
      id: 'eager-called-strategy-agent',
      name: 'Eager called strategy agent',
      instructions: 'Call tool-a once.',
      model: createToolCallModel(CALL_A, record),
      tools: { 'tool-a': recordingTool(record) },
    });

    await drain(
      await agent.stream('go', {
        maxSteps: 1,
        eagerToolExecution: true,
        toolCallConcurrency: { limit: 4, strategy: 'called' } satisfies ToolCallConcurrency,
      }),
    );

    // The full called set is unknowable while streaming, so 'called' keeps its post-finish semantics.
    expect(events).toEqual(['complete-call-a', 'later-output', 'finish', 'input-available-a', 'execute-a']);
  });
});

describe('eager tool dispatch — ordering and exactly-once', () => {
  it('preserves model-call order when executions settle in reverse', async () => {
    const { record } = createRecorder();
    const executionCounts = new Map<string, number>();
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
      model: createToolCallModel(
        [
          { toolCallId: 'call-a', toolName: 'slow', input: { value: 'a' } },
          { toolCallId: 'call-b', toolName: 'fast', input: { value: 'b' } },
        ],
        record,
      ),
      tools: { slow: makeTool('slow', 60), fast: makeTool('fast', 1) },
    });

    const chunks = await drain(
      await agent.stream('go', { maxSteps: 1, eagerToolExecution: true, toolCallConcurrency: 2 }),
    );

    // "fast" settles first, but the foreach remains the owner of result order.
    const resultIds = chunks.filter(chunk => chunk.type === 'tool-result').map(chunk => chunk.payload.toolCallId);
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
    const safeTools = { 'safe-a': peakTrackingTool('safe-a', peak), 'safe-b': peakTrackingTool('safe-b', peak) };
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
      model: createToolCallModel(
        [
          { toolCallId: 'call-a', toolName: 'safe-a', input: { value: 'a' } },
          { toolCallId: 'call-b', toolName: 'safe-b', input: { value: 'b' } },
        ],
        record,
      ),
      // The agent's own tool set is entirely safe, so the limit resolved at build time is 5.
      tools: safeTools,
    });

    await drain(
      await agent.stream('go', {
        maxSteps: 1,
        eagerToolExecution: true,
        toolCallConcurrency: 5,
        // The approval-capable tool only enters at step level, where llm-execution recomputes
        // the limit down to 1. A coordinator holding a construction-time copy would still run
        // the safe calls in parallel; reading the limit late keeps one source of truth.
        prepareStep: () => ({ tools: { ...safeTools, gated } }),
      }),
    );

    expect(peak.max).toBe(1);
  });
});

describe('eager tool dispatch — unsafe terminations', () => {
  it('never starts queued eager work before an unsafe termination', async () => {
    const { events, record } = createRecorder();
    // Two calls, limit 1: the first occupies the permit, the second is queued. The model then
    // truncates; the foreach still runs both afterwards, but the queued one must not start early.
    const model = createToolCallModel(
      [
        { toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'call-a' } },
        { toolCallId: 'call-b', toolName: 'tool-a', input: { value: 'call-b' } },
      ],
      record,
      { finishReason: 'length', pauseMs: 60 },
    );
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

    await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: true, toolCallConcurrency: 1 }));

    const finishIndex = events.indexOf('finish');
    // The running call is adopted — a real side effect is never discarded. The queued one waited.
    expect(events.indexOf('execute-call-a')).toBeLessThan(finishIndex);
    const secondIndex = events.indexOf('execute-call-b');
    expect(secondIndex === -1 || secondIndex > finishIndex).toBe(true);
  });

  /**
   * A `processToolResult` processor excludes early dispatch when a provider-executed
   * tool is also configured (`llm-execution-step.ts` computes that conjunction), and the
   * reason is stronger than the post-stream exclusion next to it. Without a provider
   * tool the hook only sees results after the post-stream pass, so dispatch stays on.
   *
   * The hook runs *inside* the model stream. When it aborts, `llm-execution-step.ts`
   * builds a bail response and returns before the post-stream pass ever runs — so
   * without early execution the tool is never started. Starting one early would make
   * the two schedules disagree about whether the tool ran at all, not merely about
   * when, and no bookkeeping at the bail can repair that. Unlike a runtime `suspend()`,
   * this hook is declared on the processor, so it can be excluded up front.
   */
  async function runToolResultProcessorScenario(
    eagerToolExecution: boolean,
    trippingToolName: string,
    { withProviderTool = true }: { withProviderTool?: boolean } = {},
  ) {
    const { events, record } = createRecorder();
    const effects: string[] = [];

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
            controller.enqueue({
              type: 'tool-call',
              toolCallId: 'call-local',
              toolName: 'local-tool',
              input: JSON.stringify({ value: 'local' }),
            });
            // Long enough that an eagerly dispatched body would have run by now.
            await new Promise(resolve => setTimeout(resolve, 150));
            // A deferred provider-executed result: the only shape that reaches the
            // stream-level hook, and therefore the only one that can bail the attempt.
            controller.enqueue({
              type: 'tool-result',
              toolCallId: 'call-provider',
              toolName: 'web_search',
              providerExecuted: true,
              result: { hits: 1 },
            });
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

    class TripwireOnToolResult {
      readonly id = 'tripwire-on-tool-result';
      async processToolResult({ toolName, abort }: any) {
        if (toolName === trippingToolName) {
          record('tripwire');
          abort(`blocked by ${trippingToolName}-guard`);
        }
      }
    }

    const work = trackEagerWork();
    const agent = new Agent({
      id: 'eager-tool-result-processor-agent',
      name: 'Eager tool-result processor agent',
      instructions: 'Call the tool.',
      model,
      tools: {
        'local-tool': createTool({
          id: 'local-tool',
          description: 'The call whose execution must not depend on the schedule.',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => {
            record('execute-local');
            effects.push('local');
            return { value };
          },
        }),
        ...(withProviderTool
          ? { web_search: { type: 'provider-defined', id: 'openai.web_search', args: {} } as any }
          : {}),
      },
      outputProcessors: [new TripwireOnToolResult() as any],
    });

    const chunks = await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution }));
    // Anything dispatched early must have run before the effects are compared.
    await work.idle();

    return { events, effects, types: chunks.map(chunk => chunk.type) };
  }

  it('does not start a call early when a processToolResult tripwire bails the attempt', async () => {
    const off = await runToolResultProcessorScenario(false, 'web_search');
    const on = await runToolResultProcessorScenario(true, 'web_search');

    // The tripwire really fired on the stream-level hook and really bailed the attempt.
    expect(on.events).toContain('tripwire');
    expect(on.types).toContain('tripwire');
    // The two schedules agree on whether the tool ran, not merely on the chunks.
    expect(off.effects).toEqual([]);
    expect(on.effects).toEqual(off.effects);
    expect(on.types).toEqual(off.types);
  });

  it.each([
    // With a provider tool in the step the hook can fire mid-stream, so the run waits.
    {
      withProviderTool: true,
      early: false,
      name: 'leaves the run to the post-stream pass when a provider tool is configured',
    },
    // The exclusion is the conjunction: the hook alone only sees results after adoption.
    { withProviderTool: false, early: true, name: 'still dispatches early when no provider tool is configured' },
  ])('with a processToolResult hook, $name', async ({ withProviderTool, early }) => {
    const on = await runToolResultProcessorScenario(true, 'nothing-trips', { withProviderTool });

    expect(on.events).not.toContain('tripwire');
    expect(on.effects).toEqual(['local']);
    const executed = on.events.indexOf('execute-local');
    const finished = on.events.indexOf('finish');
    expect(early ? executed < finished : executed > finished).toBe(true);
  });

  it('still dispatches early when an output processor declares no tool-result hook', async () => {
    // The guard keys on `processToolResult`; a stream-only processor must not cost early dispatch.
    const { events, record } = createRecorder();
    const agent = new Agent({
      id: 'eager-stream-only-processor-agent',
      name: 'Eager stream-only processor agent',
      instructions: 'Call the tool.',
      model: createToolCallModel(CALL_A, record),
      tools: { 'tool-a': recordingTool(record) },
      outputProcessors: [{ id: 'stream-only-processor', processOutputStream: async ({ part }: any) => part } as any],
    });

    await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: true }));

    // Establish execution first: an absent body is `-1`, which would pass the ordering check.
    expect(events.filter(event => event === 'execute-a')).toHaveLength(1);
    expect(events.indexOf('execute-a')).toBeLessThan(events.indexOf('finish'));
  });

  /**
   * The dispatch backstop is unconditional, and on an ordinary finish the foreach is
   * still going to adopt whatever is in flight. Cancelling there would strip the
   * adoption entry and make the foreach run the body a second time.
   *
   * This carries no processor at all: the exclusion above removed the scenario that
   * used to cover this invariant, but the invariant itself never depended on one.
   */
  it('runs a call in flight at the backstop exactly once', async () => {
    const { events, record } = createRecorder();

    // The barrier is keyed on the backstop itself rather than on the model's `finish`,
    // because `finish` is recorded when the mock enqueues the chunk — a tool timed to
    // outlast that can still settle before the backstop runs under load, at which point
    // there is nothing left to cancel and the test passes for the wrong reason. Holding
    // the tool open until `stop()` has actually been reached makes the window real
    // rather than inferred. `onModelFinished` calls `stop()` first, the backstop second.
    let releaseSlow: () => void;
    const slowReleased = new Promise<void>(resolve => {
      releaseSlow = resolve;
    });
    // Bound the wait: if the barrier is ever keyed to a call that stops happening, the
    // tool would park forever, `drain` would never return, and the cleanup below would
    // never run — stranding a spy on a shared prototype for the rest of the file. The
    // bound turns that into an ordinary failing assertion instead of a runner timeout.
    let barrierTimedOut = false;
    const barrier = async () => {
      let bound: ReturnType<typeof setTimeout>;
      await Promise.race([
        slowReleased.then(() => clearTimeout(bound)),
        new Promise<void>(resolve => {
          // Generous scheduling headroom, while still landing below the runner timeout
          // so a release that never arrives fails as an assertion rather than a dead run.
          // Expiry does not prove the release was unreachable, only that it did not
          // arrive in time — which is all the assertion below claims.
          bound = setTimeout(() => {
            barrierTimedOut = true;
            resolve();
          }, 10_000);
        }),
      ]);
    };
    let stopCalls = 0;
    const originalStop = EagerToolExecutionCoordinator.prototype.stop;
    const stopSpy = vi.spyOn(EagerToolExecutionCoordinator.prototype, 'stop').mockImplementation(function (
      this: EagerToolExecutionCoordinator,
      ...args: any[]
    ) {
      // Call through first: the backstop's own cancellation decision is the behaviour
      // under test, so it must happen before the tool is released, not after.
      const completed = (originalStop as any).apply(this, args);
      if (++stopCalls === 2) releaseSlow();
      return completed;
    });

    const model = createToolCallModel(
      [{ toolCallId: 'call-slow', toolName: 'slow-tool', input: { value: 'slow' } }],
      record,
    );

    const agent = new Agent({
      id: 'eager-inflight-at-backstop-agent',
      name: 'Eager in-flight at backstop agent',
      instructions: 'Call the tool.',
      model,
      tools: {
        'slow-tool': createTool({
          id: 'slow-tool',
          description: 'Still running when the model stream finishes.',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => {
            record('enter-slow');
            await barrier();
            record('finish-slow');
            return { value };
          },
        }),
      },
    });

    try {
      await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: true }));
    } finally {
      releaseSlow!();
      stopSpy.mockRestore();
    }

    // The barrier only lifts once `stop()` has been reached twice, so the tool was
    // provably still running when the backstop made its cancellation decision — and the
    // decision must have been to leave it alone.
    //
    // `toBe(2)` rather than `>= 2` on purpose. The counter identifies the second call,
    // not its call site, so an added earlier `stop()` would release the tool ahead of
    // the backstop and restore the silent pass this barrier exists to remove. Pinning
    // the count means a removed call fails as a timed-out barrier and an added one
    // fails here, instead of either quietly re-keying the test.
    expect(barrierTimedOut, 'barrier expired before the second stop() released the tool').toBe(false);
    expect(stopCalls).toBe(2);
    expect(events.indexOf('enter-slow')).toBeLessThan(events.indexOf('finish'));
    expect(events.indexOf('finish-slow')).toBeGreaterThan(events.indexOf('finish'));
    expect(events.filter(event => event === 'enter-slow')).toHaveLength(1);
    expect(events.filter(event => event === 'finish-slow')).toHaveLength(1);
  });
});

describe('eager tool dispatch — discarded model attempt', () => {
  type Controller = ReadableStreamDefaultController<any>;
  type Script = (controller: Controller) => Promise<void> | void;

  const signal = () => {
    let fire!: () => void;
    const fired = new Promise<void>(resolve => (fire = resolve));
    return { fired, fire };
  };
  /** One macrotask, so rejections and settlements already queued as microtasks land first. */
  const tick = () => new Promise(resolve => setImmediate(resolve));

  const emitCall = (controller: Controller, toolCallId: string, value: string) =>
    controller.enqueue({ type: 'tool-call', toolCallId, toolName: 'tool-a', input: JSON.stringify({ value }) });
  const recover: Script = controller => {
    controller.enqueue({ type: 'text-start', id: 'text-1' });
    controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'recovered' });
    controller.enqueue({ type: 'text-end', id: 'text-1' });
    controller.enqueue({
      type: 'finish',
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    });
    controller.close();
  };
  /** Emits a call, waits for `ready`, then fails with an `error` chunk (answerable by an error processor). */
  const callThenErrorChunk =
    (toolCallId: string, value: string, ready: () => Promise<unknown>): Script =>
    async controller => {
      emitCall(controller, toolCallId, value);
      await ready();
      controller.enqueue({ type: 'error', error: new Error('transient provider failure') });
      controller.close();
    };
  /** Emits a call, waits for `ready`, then errors the stream itself (the fallback route). */
  const callThenThrow =
    (toolCallId: string, value: string, ready: () => Promise<unknown>): Script =>
    async controller => {
      emitCall(controller, toolCallId, value);
      await ready();
      controller.error(new Error('model blew up mid-stream'));
    };

  /** A model that runs `scripts[n]` on its n-th stream (the last one repeats) and records each prompt. */
  function scriptedModel(modelId: string, scripts: Script[], prompts: any[][] = []) {
    return new MockLanguageModelV2({
      modelId,
      doStream: async ({ prompt }) => {
        const script = scripts[Math.min(prompts.length, scripts.length - 1)]!;
        prompts.push(prompt as any[]);
        const id = `response-${prompts.length}`;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({ type: 'response-metadata', id, modelId, timestamp: new Date(0) });
              await script(controller);
            },
          }),
        };
      },
    });
  }

  const retryOnce = [
    {
      id: 'retry-once',
      processAPIError: async ({ retryCount }: { retryCount: number }) => ({ retry: retryCount < 1 }),
    },
  ] as never;

  /**
   * Records that it ran. The discarded call then holds until it is aborted or the pipeline starts
   * waiting it out (`settleRunning`), whichever comes first; `started` fires once it is running.
   */
  function abortAwareTool(record: Recorder['record'], started = signal()) {
    const waited = signal();
    const settleRunning = EagerToolExecutionCoordinator.prototype.settleRunning;
    vi.spyOn(EagerToolExecutionCoordinator.prototype, 'settleRunning').mockImplementation(function (
      this: EagerToolExecutionCoordinator,
      ...args: Parameters<typeof settleRunning>
    ) {
      waited.fire();
      return settleRunning.apply(this, args);
    });
    return createTool({
      id: 'tool-a',
      description: 'Records that it ran',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ({ value }, options) => {
        record(`execute-${value}`);
        started.fire();
        const abortSignal = (options as { abortSignal?: AbortSignal } | undefined)?.abortSignal;
        if (value === 'discarded' && abortSignal) {
          await Promise.race([
            waited.fired,
            new Promise<void>(resolve => {
              if (abortSignal.aborted) return resolve();
              abortSignal.addEventListener('abort', () => resolve(), { once: true });
            }),
          ]);
          if (abortSignal.aborted) record(`aborted-${value}`);
        }
        return { value };
      },
    });
  }

  let finished = signal();
  /** The finished-work scenarios fail the attempt only once the call has returned and settled. */
  const finishedReady = async () => {
    await finished.fired;
    await tick();
  };

  it.each([
    {
      // An error chunk answered by `retry`: the replacement attempt must be told what already ran.
      route: 'the replacement attempt',
      build: (prompts: any[][]) => ({
        model: scriptedModel(
          'mock-model',
          [callThenErrorChunk('call-finished', 'finished', finishedReady), recover],
          prompts,
        ),
        errorProcessors: retryOnce,
      }),
    },
    {
      // The fallback route throws instead of returning a retry; it must hand the work over too.
      route: 'the next fallback model',
      build: (prompts: any[][]) => ({
        model: [
          {
            model: scriptedModel('failing-model', [callThenThrow('call-finished', 'finished', finishedReady)], prompts),
          },
          { model: scriptedModel('fallback-model', [recover], prompts) },
        ] as never,
      }),
    },
  ])('hands $route work the discarded attempt already finished', async ({ build }) => {
    // Cancellation only answers for work still running. A tool that *finished* has had its side
    // effect, so the next model call must see it — otherwise it asks again and it runs twice.
    const executions: string[] = [];
    const prompts: any[][] = [];
    finished = signal();
    const agent = new Agent({
      id: 'eager-finished-work-agent',
      name: 'Eager finished work agent',
      instructions: 'Call tool-a.',
      ...build(prompts),
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Finishes immediately',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ answer: z.string() }),
          execute: async ({ value }) => {
            executions.push(value);
            queueMicrotask(finished.fire);
            return { answer: `answered-${value}` };
          },
        }),
      },
    });

    await drain(await agent.stream('go', { maxSteps: 3, eagerToolExecution: true })).catch(() => {});

    // The second model call was really reached, and the tool ran once, eagerly.
    expect(prompts.length).toBe(2);
    expect(executions).toEqual(['finished']);
    const nextPrompt = JSON.stringify(prompts[1]);
    expect(nextPrompt).toContain('call-finished');
    expect(nextPrompt).toContain('answered-finished');
  });

  it('lets eager work finish when an error chunk is answered with a retry', async () => {
    // The error-chunk retry reaches a different early return than the thrown case. Running
    // work is waited out, not cancelled: a cancelled call is one the replacement may repeat.
    const run = async (eagerToolExecution: boolean) => {
      const { events, record } = createRecorder();
      const prompts: any[][] = [];
      const started = signal();
      const work = trackEagerWork();
      // With eager dispatch the attempt fails only once its call is running.
      const ready = () => (eagerToolExecution ? started.fired : Promise.resolve());
      const agent = new Agent({
        id: `eager-error-retry-agent-${eagerToolExecution}`,
        name: 'Eager error retry agent',
        instructions: 'Call tool-a.',
        model: scriptedModel(
          'mock-model',
          [callThenErrorChunk('call-discarded', 'discarded', ready), recover],
          prompts,
        ),
        errorProcessors: retryOnce,
        tools: { 'tool-a': abortAwareTool(record, started) },
      });
      await drain(await agent.stream('go', { maxSteps: 3, eagerToolExecution })).catch(() => {});
      await work.idle();
      vi.restoreAllMocks();
      // The retry really happened, so the run did not just die early.
      expect(prompts.length).toBe(2);
      return events;
    };

    // The discarded attempt's call never runs without eager dispatch; with it, it runs to completion.
    expect(await run(false)).toEqual([]);
    expect(await run(true)).toEqual(['execute-discarded']);
  });

  it('lets eager work finish when the pipeline discards its attempt', async () => {
    const run = async (eagerToolExecution: boolean) => {
      const { events, record } = createRecorder();
      const started = signal();
      const work = trackEagerWork();
      const ready = () => (eagerToolExecution ? started.fired : Promise.resolve());
      const agent = new Agent({
        id: `eager-fallback-agent-${eagerToolExecution}`,
        name: 'Eager fallback agent',
        instructions: 'Call tool-a.',
        model: [
          {
            model: scriptedModel('failing-model', [callThenThrow('call-discarded', 'discarded', ready)]),
            maxRetries: 0,
          },
          {
            // Deliberately reuses the discarded toolCallId with new args: nothing may adopt the old promise.
            model: scriptedModel('recovering-model', [
              controller => {
                emitCall(controller, 'call-discarded', 'retried');
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
                controller.close();
              },
            ]),
            maxRetries: 0,
          },
        ] as any,
        tools: { 'tool-a': abortAwareTool(record, started) },
      });
      await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution, toolCallConcurrency: 1 })).catch(
        () => {},
      );
      // Any eager execution still running must surface before the assertion.
      await work.idle();
      vi.restoreAllMocks();
      return events;
    };

    // The normal pipeline only runs the surviving call, which reuses the same toolCallId.
    expect(await run(false)).toEqual(['execute-retried']);
    // Eager had already started the discarded one, so it runs to completion rather than being
    // cancelled — and the surviving call still runs for real instead of adopting that promise.
    const withEager = await run(true);
    expect(withEager).toEqual(['execute-discarded', 'execute-retried']);
  });
});

describe('eager tool dispatch across steps', () => {
  it('still dispatches eagerly on the second step', async () => {
    // Dispatch is closed at the end of every step now, including a clean one, so the
    // per-step reset is what keeps the feature alive past step 1. Without a multi-step
    // test, moving or gating that reset would turn this into "eager for the first step
    // only" and every other test here would stay green.
    const { events, record } = createRecorder();
    let step = 0;

    const model = new MockLanguageModelV2({
      doStream: async () => {
        step += 1;
        const call = step === 1 ? 'call-a' : 'call-b';
        const lastStep = step > 2;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: `response-${step}`,
                modelId: 'mock-model',
                timestamp: new Date(0),
              });
              if (!lastStep) {
                record(`complete-${call}`);
                controller.enqueue({
                  type: 'tool-call',
                  toolCallId: call,
                  toolName: 'tool-a',
                  input: JSON.stringify({ value: call }),
                });
                await new Promise(resolve => setTimeout(resolve, 100));
                record(`later-output-${step}`);
              }
              controller.enqueue({ type: 'text-start', id: `text-${step}` });
              controller.enqueue({ type: 'text-delta', id: `text-${step}`, delta: 'later' });
              controller.enqueue({ type: 'text-end', id: `text-${step}` });
              record(`finish-${step}`);
              controller.enqueue({
                type: 'finish',
                finishReason: lastStep ? 'stop' : 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        };
      },
    });

    const agent = new Agent({
      id: 'eager-multi-step-agent',
      name: 'Eager multi step agent',
      instructions: 'Call tool-a, then answer.',
      model,
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Plain tool',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => {
            record(`execute-${value}`);
            return { value };
          },
        }),
      },
    });

    await drain(await agent.stream('go', { maxSteps: 3, eagerToolExecution: true }));

    // Step 1 dispatched early, which the single-step tests already cover. The load-bearing
    // assertion is the second one: step 2's call also runs before that step's own output.
    expect(events.indexOf('execute-call-a')).toBeLessThan(events.indexOf('later-output-1'));
    expect(events.indexOf('execute-call-b')).toBeLessThan(events.indexOf('later-output-2'));
  });
});

describe('eager tool dispatch — the terminal window', () => {
  it('does not promote a queued call when an execution settles as the model finishes', async () => {
    // The hole this closes: dispatch used to be shut after the stream loop returned, so
    // an execution settling between the model's terminal chunk and that moment would free
    // its permit and promote the next queued call. That call then ran under a limit that
    // had already been handed to the foreach.
    const coordinator = new EagerToolExecutionCoordinator(() => 1);
    let started = 0;
    let releaseA!: () => void;
    const aHeld = new Promise<void>(resolve => {
      releaseA = resolve;
    });

    coordinator.start('call-a', async () => {
      started++;
      await aHeld;
      return { result: 'a' } as never;
    });
    coordinator.start('call-b', async () => {
      started++;
      return { result: 'b' } as never;
    });
    expect(started).toBe(1);

    // Terminal chunk accepted: dispatch closes here, synchronously, before anything else
    // gets a turn. Only then does A settle and give its permit back.
    coordinator.stop();
    releaseA();
    await vi.waitFor(() => expect(coordinator.running).toBe(0));

    // B was never promoted, and is no longer adoptable, so the foreach runs it itself.
    expect(started).toBe(1);
    expect(coordinator.take('call-b')).toBeUndefined();
  });
});

describe('EagerToolExecutionCoordinator', () => {
  it('releases the permit of cancelled work so a retry never queues behind a zombie', async () => {
    const coordinator = new EagerToolExecutionCoordinator(() => 1);
    let started = 0;

    // Deliberately antisocial: acknowledges nothing and never settles, which is exactly
    // the tool that would otherwise hold the only permit for the rest of the run.
    coordinator.start('call-1', async () => {
      started++;
      return await new Promise<never>(() => {});
    });
    expect(started).toBe(1);

    coordinator.stop({ cancelRunning: true });
    coordinator.beginTurn();

    // The replacement attempt's call must start, not wait on work nobody is coming back for.
    coordinator.start('call-1', async () => {
      started++;
      return { result: 'retried' } as never;
    });

    await vi.waitFor(() => expect(started).toBe(2));
    expect(coordinator.running).toBe(1);
  });

  it('ignores a suspension from cancelled work that ignored the abort', async () => {
    const coordinator = new EagerToolExecutionCoordinator(() => 1);
    let suspendLate!: () => void;

    coordinator.start(
      'call-1',
      () =>
        new Promise<never>((_, reject) => {
          suspendLate = () =>
            reject(new EagerToolExecutionNotRun('suspended', { suspension: { payload: {} } as never }));
        }),
    );

    coordinator.stop({ cancelRunning: true });
    coordinator.beginTurn();
    suspendLate();
    await new Promise(resolve => setTimeout(resolve, 0));

    // A zombie from the discarded attempt must not block the replacement from retrying.
    expect(coordinator.hasSuspendedHandback).toBe(false);
  });

  it('stops waiting for running work once the run aborts', async () => {
    const coordinator = new EagerToolExecutionCoordinator(() => 1);
    coordinator.start('call-1', () => new Promise<never>(() => {}));
    coordinator.stop();

    const controller = new AbortController();
    let settled = false;
    void coordinator.settleRunning(controller.signal).then(() => (settled = true));
    controller.abort();
    // One macrotask turn drains every pending microtask; the running work never settles.
    await new Promise(resolve => setImmediate(resolve));

    expect(settled).toBe(true);
  });

  it('aborts and forgets running work when the caller aborts, not just queued work', async () => {
    // What the caller-abort listener asks of the coordinator. The run's own signal only
    // reaches tools that bother to observe it, and an aborted run bails before any
    // foreach, so without this the work is neither stopped, adopted, nor released.
    const coordinator = new EagerToolExecutionCoordinator(() => 2);
    let sawAbort = false;

    coordinator.start('call-1', async signal => {
      signal.addEventListener('abort', () => (sawAbort = true), { once: true });
      return await new Promise<never>(() => {});
    });
    expect(coordinator.running).toBe(1);

    coordinator.stop({ permanent: true, cancelRunning: true });

    expect(sawAbort).toBe(true);
    expect(coordinator.running).toBe(0);
    expect(coordinator.pendingAdoptions).toBe(0);
  });

  it('forgets cancelled work so a reused toolCallId cannot adopt a discarded attempt', async () => {
    const coordinator = new EagerToolExecutionCoordinator(() => 4);
    let released!: () => void;
    const held = new Promise<void>(resolve => {
      released = resolve;
    });

    coordinator.start('call-1', async () => {
      await held;
      return { result: 'from the discarded attempt' } as never;
    });
    expect(coordinator.pendingAdoptions).toBe(1);

    coordinator.stop({ cancelRunning: true });

    // Aborted *and* forgotten: the foreach must execute this call itself rather than
    // adopt work belonging to an attempt that no longer exists.
    expect(coordinator.pendingAdoptions).toBe(0);
    expect(coordinator.take('call-1')).toBeUndefined();

    released();
  });

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

  it('takes carried work back when the message it was committed under is removed', () => {
    // A processor retry deletes the rejected attempt's messages by id. If a previous
    // discard had committed finished eager work under that same id, the delete would take
    // the only record of a side effect with it, and the next attempt would run the tool
    // again. The work goes back into the carry buffer instead.
    const coordinator = new EagerToolExecutionCoordinator(() => 1);
    const work = [{ toolCallId: 'call-1', toolName: 'tool-a', args: {}, result: { ok: true }, sequence: 0 }];

    coordinator.carryDiscardedWork(work);
    const committed = coordinator.takeCarriedWork();
    expect(committed).toEqual(work);
    expect(coordinator.carriedWork).toEqual([]);

    coordinator.recordCommittedWork('message-1', committed);

    // A different message being removed is none of its business.
    expect(coordinator.recarryCommittedWork('message-2')).toBe(false);
    expect(coordinator.carriedWork).toEqual([]);

    expect(coordinator.recarryCommittedWork('message-1')).toBe(true);
    expect(coordinator.carriedWork).toEqual(work);

    // Taken back once, not once per removal: a second remove of the same id must not
    // duplicate the call in the conversation.
    expect(coordinator.recarryCommittedWork('message-1')).toBe(false);
    expect(coordinator.carriedWork).toEqual(work);
  });

  it('takes back every batch committed under a removed id, not just the last one', () => {
    // A chain of failing attempts commits under the same id more than once: each
    // replacement writes what the previous one had finished. Keeping only the newest
    // batch would let one `removeByIds` delete an earlier tool's only record, and the
    // attempt after that would run it a second time.
    const coordinator = new EagerToolExecutionCoordinator(() => 1);
    const first = { toolCallId: 'call-a', toolName: 'tool-a', args: {}, result: 'a', sequence: 0 };
    const second = { toolCallId: 'call-b', toolName: 'tool-b', args: {}, result: 'b', sequence: 0 };

    // Same array instance both times: a store that kept the caller's array instead of
    // copying it would then have the second batch append into the first and read back
    // correctly by accident.
    const batch = [first];
    coordinator.recordCommittedWork('message-1', batch);
    batch[0] = second;
    coordinator.recordCommittedWork('message-1', batch);

    expect(coordinator.recarryCommittedWork('message-1')).toBe(true);
    expect(coordinator.carriedWork).toEqual([first, second]);

    // The whole entry left with that removal — a second removal of the same id must not
    // write either batch into the conversation twice.
    expect(coordinator.recarryCommittedWork('message-1')).toBe(false);
    expect(coordinator.carriedWork).toEqual([first, second]);
  });

  it('keeps each discarded attempt in model-call order, and attempts in discard order', () => {
    // Calls inside one batch keep the order the model emitted them; batches keep the
    // order they were discarded in. `sequence` happens to be run-global today, so a sort
    // of the whole buffer would agree — sorting per batch keeps that coincidence from
    // becoming load-bearing.
    const coordinator = new EagerToolExecutionCoordinator(() => 1);
    coordinator.carryDiscardedWork([
      { toolCallId: 'first-b', toolName: 'tool-b', args: {}, result: 'b', sequence: 1 },
      { toolCallId: 'first-a', toolName: 'tool-a', args: {}, result: 'a', sequence: 0 },
    ]);
    coordinator.carryDiscardedWork([
      { toolCallId: 'second-a', toolName: 'tool-a', args: {}, result: 'a', sequence: 0 },
    ]);

    expect(coordinator.takeCarriedWork().map(work => work.toolCallId)).toEqual(['first-a', 'first-b', 'second-a']);
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
        }),
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
        options: { eagerToolExecution: true },
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
        options: { eagerToolExecution: false },
      }),
    ).resolves.toBeDefined();
  });
});

describe('eager suspension intent carrier', () => {
  // The eager attempt is abandoned before any suspension side effect happens, so what the
  // tool asked for has to ride out on the rejection. These are deliberately unit level:
  // at this stage nothing an Agent can observe has changed, because the adopting iteration
  // stashes the intent without acting on it yet.
  const intent = {
    suspendPayload: { message: 'need a human' },
    options: { resumeLabel: 'call-1' },
  };

  it('recovers the intent from the error it was attached to', () => {
    const error = new EagerToolExecutionNotRun('"ask" requested suspension', { suspension: intent });

    expect(eagerToolCallSuspensionIntent(error)).toEqual(intent);
  });

  it('recovers the intent from an error the swallow path minted fresh', () => {
    // The shape produced after `tool.execute` returns from a body that caught the throw:
    // a new error built from the recorded bailout rather than thrown by the suspend closure.
    const bailout: EagerToolBailout = { reason: '"ask" requested suspension', suspension: intent };
    const error = new EagerToolExecutionNotRun(bailout.reason!, { suspension: bailout.suspension });

    expect(eagerToolCallSuspensionIntent(error)).toEqual(intent);
  });

  it('carries approval-flavoured options alongside the payload', () => {
    const approvalIntent = {
      suspendPayload: { reason: 'confirm' },
      options: { requireToolApproval: true },
    };
    const error = new EagerToolExecutionNotRun('"ask" requested suspension', { suspension: approvalIntent });

    expect(eagerToolCallSuspensionIntent(error)).toEqual(approvalIntent);
  });

  it('preserves an array resumeLabel rather than narrowing it', () => {
    // `SuspendOptions.resumeLabel` is `string | string[]`, and the real suspension path
    // passes it through; a carrier typed `string` would silently drop the second label.
    const arrayIntent = { suspendPayload: {}, options: { resumeLabel: ['a', 'b'] } };
    const error = new EagerToolExecutionNotRun('"ask" requested suspension', { suspension: arrayIntent });

    expect(eagerToolCallSuspensionIntent(error)?.options.resumeLabel).toEqual(['a', 'b']);
  });

  it('is found through the MastraError the tool builder wraps a thrown suspension in', () => {
    // A runtime suspension is raised from inside the tool body, so CoreToolBuilder catches
    // it and re-throws a TOOL_EXECUTION_FAILED MastraError carrying it as `cause`.
    const inner = new EagerToolExecutionNotRun('"ask" requested suspension', { suspension: intent });
    const wrapped = new MastraError(
      { id: 'TOOL_EXECUTION_FAILED', domain: ErrorDomain.TOOL, category: ErrorCategory.USER },
      inner,
    );
    const doubleWrapped = new MastraError(
      { id: 'TOOL_EXECUTION_FAILED', domain: ErrorDomain.TOOL, category: ErrorCategory.USER },
      wrapped,
    );

    expect(eagerToolCallSuspensionIntent(doubleWrapped)).toEqual(intent);
  });

  it('returns undefined for a rejection that carries no suspension', () => {
    // A cancelled-while-queued attempt is the same branded error with nothing to replay.
    expect(eagerToolCallSuspensionIntent(new EagerToolExecutionNotRun('cancelled'))).toBeUndefined();
    expect(eagerToolCallSuspensionIntent(new Error('unrelated'))).toBeUndefined();
  });
});

describe('eager tool dispatch — runtime suspension handback', () => {
  it('runs a pre-suspend side effect exactly once and resumes the call', async () => {
    // The headline regression. Before the handback the eager attempt was discarded and the
    // foreach re-ran the body from the top, so everything the tool did before `suspend()`
    // happened twice. The append is guarded on `resumeData` because a resumed call re-enters
    // the body from the top rather than continuing the interrupted invocation.
    const storage = new InMemoryStore();
    const appends: string[] = [];
    let bodyEntries = 0;
    const { record } = createRecorder();
    const model = createOneShotToolCallModel(
      [{ toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } }],
      record,
    );
    const agent = new Agent({
      id: 'eager-handback-once-agent',
      name: 'Eager handback once agent',
      instructions: 'Call tool-a once.',
      model,
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Performs a side effect, then suspends at runtime',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: async ({ value }, options?: any) => {
            bodyEntries += 1;
            if (options?.agent?.resumeData === undefined) {
              appends.push(value);
              await options?.agent?.suspend?.({ reason: 'needs input' });
            }
            return { value };
          },
        }),
      },
    });
    new Mastra({ agents: { agent }, logger: false, storage });

    const stream = await agent.stream('go', { maxSteps: 1, eagerToolExecution: true });
    const types = (await drain(stream)).map(chunk => chunk.type);

    expect(types).toContain('tool-call-suspended');
    // One append, not two: the eager attempt's side effect is the only one that happened.
    expect(appends).toEqual(['a']);
    expect(bodyEntries).toBe(1);

    const resumed = await agent.resumeStream({ ok: true }, { runId: stream.runId, toolCallId: 'call-a' });
    await drain(resumed);

    // Resume re-enters the body, which is the pre-existing resume contract — but it takes the
    // guarded branch, so the pre-suspend side effect still happened exactly once overall.
    expect(appends).toEqual(['a']);
    expect(bodyEntries).toBe(2);
  }, 30000);

  it('lands the suspension on the suspending call’s own foreach iteration', async () => {
    // A suspension raised outside the owning iteration writes a step-level payload that
    // aliases to iteration 0, so the wrong call would resume. The later-indexed call is the
    // one that suspends here, so index 0 carrying the payload would be the bug.
    const runBatch = async (eagerToolExecution: boolean) => {
      const storage = new InMemoryStore();
      const { record } = createRecorder();
      const model = createOneShotToolCallModel(
        [
          { toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } },
          { toolCallId: 'call-b', toolName: 'tool-b', input: { value: 'b' } },
        ],
        record,
      );
      const agent = new Agent({
        id: `eager-handback-coordinate-agent-${eagerToolExecution}`,
        name: 'Eager handback coordinate agent',
        instructions: 'Call both tools.',
        model,
        tools: {
          'tool-a': createTool({
            id: 'tool-a',
            description: 'Completes normally',
            inputSchema: z.object({ value: z.string() }),
            outputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => ({ value }),
          }),
          'tool-b': createTool({
            id: 'tool-b',
            description: 'Suspends at runtime',
            inputSchema: z.object({ value: z.string() }),
            outputSchema: z.object({ value: z.string() }),
            execute: async ({ value }, options?: any) => {
              if (options?.agent?.resumeData === undefined) {
                await options?.agent?.suspend?.({ reason: 'needs input' });
              }
              return { value };
            },
          }),
        },
      });
      new Mastra({ agents: { agent }, logger: false, storage });

      const stream = await agent.stream('go', { maxSteps: 1, eagerToolExecution });
      await drain(stream);

      const workflowsStore = (await storage.getStore('workflows'))!;
      const run = await workflowsStore.getWorkflowRunById({ runId: stream.runId, workflowName: 'agentic-loop' });
      expect(run).not.toBeNull();
      return findForeachOutputWithSuspension(run!.snapshot);
    };

    const baseForeachOutput = await runBatch(false);
    const foreachOutput = await runBatch(true);

    expect(foreachOutput).not.toBeUndefined();
    // Iteration 1 is tool-b's; iteration 0 belongs to the call that already finished.
    expect(foreachOutput![0]?.suspendPayload).toBeUndefined();
    expect(foreachOutput![1]?.suspendPayload).toBeDefined();
    const payload = foreachOutput![1].suspendPayload as Record<string, unknown>;
    expect(payload).toMatchObject({ toolCallId: 'call-b', toolName: 'tool-b' });
    // The handback builds the pre-existing envelope and adds no bookkeeping field of its own.
    // `__streamState` is serialized once, on the step-level payload — the per-iteration copy
    // deliberately does not carry it, and a second copy here would be snapshot bloat
    // multiplied by iteration count.
    expect(payload.__streamState).toBeUndefined();
    // Pinned against the non-eager path rather than a literal: the handback must build the
    // envelope the foreach already builds, not a variant of it.
    expect(Object.keys(payload).sort()).toEqual(
      Object.keys(baseForeachOutput![1].suspendPayload as Record<string, unknown>).sort(),
    );
  }, 30000);

  it('resumes the suspended call without re-running its completed siblings', async () => {
    // Snapshot placement alone does not prove the resume coordinate works end to end.
    const storage = new InMemoryStore();
    let siblingRuns = 0;
    let resumeDataSeen: unknown;
    const { record } = createRecorder();
    const model = createOneShotToolCallModel(
      [
        { toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } },
        { toolCallId: 'call-b', toolName: 'tool-b', input: { value: 'b' } },
      ],
      record,
    );
    const agent = new Agent({
      id: 'eager-handback-targeted-resume-agent',
      name: 'Eager handback targeted resume agent',
      instructions: 'Call both tools.',
      model,
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Completes normally',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => {
            siblingRuns += 1;
            return { value };
          },
        }),
        'tool-b': createTool({
          id: 'tool-b',
          description: 'Suspends at runtime',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: async ({ value }, options?: any) => {
            if (options?.agent?.resumeData === undefined) {
              await options?.agent?.suspend?.({ reason: 'needs input' });
            }
            resumeDataSeen = options?.agent?.resumeData;
            return { value: `${value}-done` };
          },
        }),
      },
    });
    new Mastra({ agents: { agent }, logger: false, storage });

    const stream = await agent.stream('go', { maxSteps: 1, eagerToolExecution: true });
    const firstChunks = await drain(stream);
    expect(siblingRuns).toBe(1);
    expect(firstChunks.map(chunk => chunk.type)).toContain('tool-call-suspended');

    const resumed = await agent.resumeStream({ ok: true }, { runId: stream.runId, toolCallId: 'call-b' });
    const resumedChunks = await drain(resumed);

    // The resumed call must actually reach the tool with the resume data and finish — a
    // no-op resume would otherwise satisfy the sibling assertion below on its own.
    expect(resumeDataSeen).toEqual({ ok: true });
    const resumedResult = resumedChunks.find(
      chunk => chunk.type === 'tool-result' && (chunk as any).payload?.toolCallId === 'call-b',
    );
    expect((resumedResult as any)?.payload?.result).toMatchObject({ value: 'b-done' });
    // The sibling already produced its result; resuming call-b must not run it again.
    expect(siblingRuns).toBe(1);
  }, 30000);

  it('routes a runtime suspension that asks for approval through the approval path', async () => {
    // The handback carries the options the tool suspended with, and the approval branch is
    // gated on `options.requireToolApproval` — so an approval-flavoured intent has to emit
    // `tool-call-approval`, not the plain suspension chunk.
    const { record } = createRecorder();
    const model = createOneShotToolCallModel(
      [{ toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } }],
      record,
    );
    const agent = new Agent({
      id: 'eager-handback-approval-agent',
      name: 'Eager handback approval agent',
      instructions: 'Call tool-a once.',
      model,
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Asks for approval at runtime',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: async ({ value }, options?: any) => {
            await options?.agent?.suspend?.({ reason: 'needs approval' }, { requireToolApproval: true });
            return { value };
          },
        }),
      },
    });

    const types = (await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: true }))).map(
      chunk => chunk.type,
    );

    expect(types).toContain('tool-call-approval');
    expect(types).not.toContain('tool-call-suspended');
  }, 30000);
});
