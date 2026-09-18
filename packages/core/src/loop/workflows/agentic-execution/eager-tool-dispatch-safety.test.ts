import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../agent';
import { prepareForDurableExecution } from '../../../agent/durable/preparation';
import { Mastra } from '../../../mastra';
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

    const chunks = await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: true }));

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

  it('does not eagerly execute when approval comes from the run-level policy', async () => {
    const { events, record } = createRecorder();
    const model = createToolCallModel([{ toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } }], record);

    // The tool itself is a plain eligible tool. The veto is entirely run-level, which is
    // a source the whitelist has to consult separately from the tool's own flag.
    const agent = new Agent({
      id: 'eager-run-approval-agent',
      name: 'Eager run approval agent',
      instructions: 'Call tool-a once.',
      model,
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Plain tool',
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

    await drain(
      await agent.stream('go', {
        maxSteps: 1,
        eagerToolExecution: true,
        requireToolApproval: true,
      }),
    );

    expect(events.slice(0, 3)).toEqual(['complete-call-a', 'later-output', 'finish']);
    expect(events.indexOf('execute-a')).toBe(-1);
  });

  it('does not eagerly execute a tool whose approval is decided by a predicate', async () => {
    const { events, record } = createRecorder();
    const model = createToolCallModel([{ toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } }], record);

    // A predicate is async and may do real work before deciding, so its answer is not
    // available at dispatch time. Unknown has to mean ineligible. Note the tool builder
    // converts a predicate into `requireApproval: true` plus a `needsApprovalFn`, so what
    // actually stops this today is the flag check; this pins the user-visible behaviour
    // rather than one particular guard.
    const agent = new Agent({
      id: 'eager-predicate-approval-agent',
      name: 'Eager predicate approval agent',
      instructions: 'Call tool-a once.',
      model,
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Approval by predicate',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          requireApproval: async () => true,
          onInputAvailable: async () => record('input-available-a'),
          execute: async ({ value }) => {
            record('execute-a');
            return { value };
          },
        }) as never,
      },
    });

    await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: true }));

    expect(events.slice(0, 3)).toEqual(['complete-call-a', 'later-output', 'finish']);
    expect(events.indexOf('execute-a')).toBe(-1);
  });

  it('does not eagerly execute a tool the step has filtered out of activeTools', async () => {
    const { events, record } = createRecorder();
    const model = createToolCallModel([{ toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } }], record);

    const agent = new Agent({
      id: 'eager-active-tools-agent',
      name: 'Eager activeTools agent',
      instructions: 'Call tool-a once.',
      model,
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Filtered out of this step',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          onInputAvailable: async () => record('input-available-a'),
          execute: async ({ value }) => {
            record('execute-a');
            return { value };
          },
        }),
        'tool-b': createTool({
          id: 'tool-b',
          description: 'The only active tool',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: async ({ value }) => ({ value }),
        }),
      },
    });

    await drain(
      await agent.stream('go', {
        maxSteps: 1,
        eagerToolExecution: true,
        activeTools: ['tool-b'],
      }),
    );

    // The foreach rejects an inactive call and eager dispatch must not run it first.
    // A filtered tool is also absent from the resolved set, so the explicit activeTools
    // check is belt-and-braces; this pins the behaviour, whichever guard delivers it.
    expect(events.indexOf('execute-a')).toBe(-1);
    // Distinguishes "never dispatched" from "dispatched but execute was not reached":
    // onInputAvailable fires early on the eager path and not at all on this one.
    expect(events.indexOf('input-available-a')).toBe(-1);
  });

  it('does not eagerly execute when an output processor runs after the stream', async () => {
    // A processor with `processLLMResponse` or `processOutputStep` is allowed to rewrite
    // or drop the whole response before any tool runs. Starting a tool early would put a
    // side effect behind a response that processor can still veto, so the presence of one
    // disables eager dispatch for the entire turn rather than per call.
    const { events, record } = createRecorder();
    const model = createToolCallModel([{ toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } }], record);

    const agent = new Agent({
      id: 'eager-post-stream-processor-agent',
      name: 'Eager post-stream processor agent',
      instructions: 'Call tool-a once.',
      model,
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Ordinary server tool',
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

    await drain(
      await agent.stream('go', {
        maxSteps: 1,
        eagerToolExecution: true,
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
    );

    // Guard the guard: if the processor never ran, the exclusion was never exercised.
    expect(events).toContain('post-stream-processor');
    // The tool still runs, but only on the normal path after the model finished.
    expect(events).toContain('execute-a');
    const finishIndex = events.indexOf('finish');
    for (const event of ['input-available-a', 'execute-a']) {
      expect(events.indexOf(event)).toBeGreaterThan(finishIndex);
    }
  });

  it('does not eagerly execute a client-side tool, which has no execute to call', async () => {
    // A tool with no `execute` is the caller's to run. There is nothing to start early,
    // and dispatching it would fire `onInputAvailable` for a call this process never runs.
    const { events, record } = createRecorder();
    const model = createToolCallModel([{ toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } }], record);

    const agent = new Agent({
      id: 'eager-client-side-agent',
      name: 'Eager client-side agent',
      instructions: 'Call tool-a once.',
      model,
      tools: {
        'tool-a': {
          id: 'tool-a',
          description: 'Client-side tool with no execute',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          onInputAvailable: async () => record('input-available-a'),
        } as any,
      },
    });

    await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: true }));

    // Nothing may be dispatched early: `onInputAvailable` is the discriminating signal,
    // since there is no execute whose absence would otherwise be visible.
    const finishIndex = events.indexOf('finish');
    const inputAvailableIndex = events.indexOf('input-available-a');
    expect(inputAvailableIndex === -1 || inputAvailableIndex > finishIndex).toBe(true);
  });

  it('does not eagerly execute a provider-executed call', async () => {
    // The provider already ran it. Executing our own copy early would duplicate the
    // side effect and then race the provider's result into the same toolCallId.
    const { events, record } = createRecorder();
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
            record('complete-call-a');
            controller.enqueue({
              type: 'tool-call',
              toolCallId: 'call-a',
              toolName: 'tool-a',
              input: JSON.stringify({ value: 'a' }),
              providerExecuted: true,
            });
            await new Promise(resolve => setTimeout(resolve, 100));
            record('later-output');
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
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Also runs on the provider',
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

    await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: true }));

    // Our copy must never start, early or late. This pins the behaviour, not the
    // predicate's `providerExecuted` line: deleting that line alone, or all three
    // provider/client guards together, leaves this test green, because a
    // provider-executed call is not run by the normal path either. The guard is
    // redundant today and kept for the same reason as the other redundant ones.
    expect(events.indexOf('execute-a')).toBe(-1);
    expect(events.indexOf('input-available-a')).toBe(-1);
  });

  it('does not eagerly execute when the run may auto-resume a suspended tool', async () => {
    // With `autoResumeSuspendedTools`, any call in the run can be a resume rather than a
    // fresh start, and a resume is the foreach's to sequence. Nothing starts early.
    const { events, record } = createRecorder();
    const model = createToolCallModel([{ toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } }], record);

    const agent = new Agent({
      id: 'eager-auto-resume-agent',
      name: 'Eager auto-resume agent',
      instructions: 'Call tool-a once.',
      model,
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Ordinary server tool in an auto-resuming run',
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

    await drain(
      await agent.stream('go', {
        maxSteps: 1,
        eagerToolExecution: true,
        autoResumeSuspendedTools: true,
      }),
    );

    // It still runs, but on the normal path.
    expect(events).toContain('execute-a');
    const finishIndex = events.indexOf('finish');
    for (const event of ['input-available-a', 'execute-a']) {
      expect(events.indexOf(event)).toBeGreaterThan(finishIndex);
    }
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

    await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: true }));

    // Dispatch itself must not happen — see the approval case for why
    // `onInputAvailable` is the discriminating signal.
    const finishIndex = events.indexOf('finish');
    for (const event of ['input-available-a', 'execute-a']) {
      const index = events.indexOf(event);
      expect(index === -1 || index > finishIndex).toBe(true);
    }
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
      const { record } = createRecorder();
      const model = createToolCallModel([{ toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } }], record);
      // `onOutput` is the tool's own "this produced a result" hook. A denied eager attempt
      // must not reach it: the value handed to it belongs to a call that never legitimately
      // completed, and the foreach is about to run the call again.
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
      return { types: chunks.map(chunk => chunk.type), onOutputCalls };
    };

    const base = await run(false);
    const eager = await run(true);

    expect(eager.types).toEqual(base.types);
    expect(eager.types).toContain('tool-call-suspended');
    // The tool swallows the suspend on both paths, so its `onOutput` hook fires once for the
    // value it returns afterwards. The denied eager attempt must not add a second firing:
    // the value it produced belongs to a call the foreach is about to run again.
    expect(base.onOutputCalls).toBe(1);
    expect(eager.onOutputCalls).toBe(base.onOutputCalls);
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

    await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: true }));

    const finishIndex = events.indexOf('finish');
    expect(finishIndex).toBeGreaterThan(-1);
    for (const event of ['input-available-a', 'execute-a']) {
      const index = events.indexOf(event);
      expect(index === -1 || index > finishIndex).toBe(true);
    }
  });

  it('does not eagerly execute a call that config alone dispatches to the background', async () => {
    // The `_background` argument is only the highest-priority input to
    // `resolveBackgroundConfig`. An agent-level `backgroundTasks.tools` entry
    // dispatches to the background on its own, with the default 'deferred'
    // disposition and nothing at all in the call arguments. Checking the
    // argument is therefore not the same check the foreach makes.
    const { events, record } = createRecorder();
    const model = createToolCallModel([{ toolCallId: 'call-a', toolName: 'tool-a', input: { value: 'a' } }], record);

    const agent = new Agent({
      id: 'eager-config-background-agent',
      name: 'Eager config background agent',
      instructions: 'Call tool-a once.',
      model,
      backgroundTasks: { tools: { 'tool-a': true } },
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Background dispatched by agent config, not by argument',
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

    new Mastra({
      agents: { 'eager-config-background-agent': agent },
      backgroundTasks: { enabled: true },
      logger: false,
    });

    await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: true }));

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

    await drain(await agent.stream('go', { maxSteps: 1, eagerToolExecution: true }));

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

    await agent.generate('go', { maxSteps: 1, eagerToolExecution: true });

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
      }),
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
      }),
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
      }),
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
      }),
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
      }),
    );

    expect(peak.max).toBe(1);
  });
});

describe('eager tool dispatch — unsafe terminations', () => {
  it('never starts queued eager work before an unsafe termination', async () => {
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
              // Truncated output. The ordinary foreach still runs these calls afterwards,
              // exactly as it does without eager dispatch — what must not happen is the
              // queued one being started early, ahead of the model saying so.
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
      }),
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
  async function runErrorChunkRetryScenario(eagerToolExecution: boolean) {
    const { events, record } = createRecorder();
    let attempt = 0;

    // An `error` chunk answered by an error processor's `retry` is the *other* way an
    // attempt gets discarded, and it returns `toolCalls: []` exactly like the thrown
    // case. It reaches a different early return, which is how it shipped uncancelled.
    const model = new MockLanguageModelV2({
      doStream: async () => {
        attempt += 1;
        const failing = attempt === 1;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: `response-${attempt}`,
                modelId: 'mock-model',
                timestamp: new Date(0),
              });
              if (failing) {
                controller.enqueue({
                  type: 'tool-call',
                  toolCallId: 'call-discarded',
                  toolName: 'tool-a',
                  input: JSON.stringify({ value: 'discarded' }),
                });
                await new Promise(resolve => setTimeout(resolve, 20));
                controller.enqueue({ type: 'error', error: new Error('transient provider failure') });
                controller.close();
                return;
              }
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
        };
      },
    });

    const agent = new Agent({
      id: `eager-error-retry-agent-${eagerToolExecution}`,
      name: 'Eager error retry agent',
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
          description: 'Records that it ran',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: async ({ value }, options) => {
            record(`execute-${value}`);
            const signal = (options as { abortSignal?: AbortSignal } | undefined)?.abortSignal;
            if (signal) {
              await new Promise<void>(resolve => {
                if (signal.aborted) return resolve();
                signal.addEventListener('abort', () => resolve(), { once: true });
                setTimeout(resolve, 500);
              });
              if (signal.aborted) record(`aborted-${value}`);
            }
            return { value };
          },
        }),
      },
    });

    await drain(await agent.stream('go', { maxSteps: 3, eagerToolExecution })).catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 150));
    // Pins that the retry actually happened, so the assertions below cannot pass because
    // the run died early for some unrelated reason.
    expect(attempt).toBe(2);
    return events;
  }

  it('hands the replacement attempt work the discarded attempt already finished', async () => {
    // Cancellation only answers for work still running. A tool that *finished* before its
    // attempt was thrown away has already had its side effect, and the replacement model
    // call must be told about it — otherwise the only way it can learn the answer is to
    // ask for the same tool again, and the side effect happens twice.
    const executions: string[] = [];
    const prompts: any[][] = [];
    let attempt = 0;

    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        attempt += 1;
        prompts.push(prompt as any[]);
        const failing = attempt === 1;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: `response-${attempt}`,
                modelId: 'mock-model',
                timestamp: new Date(0),
              });
              if (failing) {
                controller.enqueue({
                  type: 'tool-call',
                  toolCallId: 'call-finished',
                  toolName: 'tool-a',
                  input: JSON.stringify({ value: 'finished' }),
                });
                // Long enough that the eager execution below has certainly settled before
                // the attempt is discarded, which is the whole point of the case.
                await new Promise(resolve => setTimeout(resolve, 80));
                controller.enqueue({ type: 'error', error: new Error('transient provider failure') });
                controller.close();
                return;
              }
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
        };
      },
    });

    const agent = new Agent({
      id: 'eager-finished-work-agent',
      name: 'Eager finished work agent',
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
          description: 'Finishes immediately',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ answer: z.string() }),
          execute: async ({ value }) => {
            executions.push(value);
            return { answer: `answered-${value}` };
          },
        }),
      },
    });

    await drain(await agent.stream('go', { maxSteps: 3, eagerToolExecution: true })).catch(() => {});

    expect(attempt).toBe(2);
    // The tool ran once, eagerly, during the attempt that was then discarded.
    expect(executions).toEqual(['finished']);

    // The replacement attempt is shown the completed call and its result, so it has no
    // reason to ask for the work again.
    const retryPrompt = JSON.stringify(prompts[1]);
    expect(retryPrompt).toContain('call-finished');
    expect(retryPrompt).toContain('answered-finished');
  });

  it('hands the next fallback model work the failed model already finished', async () => {
    // The fallback route discards an attempt without ever going through a retry return:
    // the callback throws, and the fallback machinery invokes it again with the next
    // model. Nothing on that path used to write the finished work, so the second model
    // was shown a clean slate and asked for the same tool again.
    const executions: string[] = [];
    const prompts: any[][] = [];

    const failingModel = new MockLanguageModelV2({
      modelId: 'failing-model',
      doStream: async ({ prompt }) => {
        prompts.push(prompt as any[]);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: 'response-failing',
                modelId: 'failing-model',
                timestamp: new Date(0),
              });
              controller.enqueue({
                type: 'tool-call',
                toolCallId: 'call-finished',
                toolName: 'tool-a',
                input: JSON.stringify({ value: 'finished' }),
              });
              // Long enough that the eager execution has certainly settled before the
              // model takes the attempt down with it.
              await new Promise(resolve => setTimeout(resolve, 80));
              controller.error(new Error('model blew up mid-stream'));
            },
          }),
        };
      },
    });

    const fallbackModel = new MockLanguageModelV2({
      modelId: 'fallback-model',
      doStream: async ({ prompt }) => {
        prompts.push(prompt as any[]);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: 'response-fallback',
                modelId: 'fallback-model',
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
        };
      },
    });

    const agent = new Agent({
      id: 'eager-fallback-work-agent',
      name: 'Eager fallback work agent',
      instructions: 'Call tool-a.',
      model: [{ model: failingModel }, { model: fallbackModel }] as never,
      tools: {
        'tool-a': createTool({
          id: 'tool-a',
          description: 'Finishes immediately',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ answer: z.string() }),
          execute: async ({ value }) => {
            executions.push(value);
            return { answer: `answered-${value}` };
          },
        }),
      },
    });

    await drain(await agent.stream('go', { maxSteps: 3, eagerToolExecution: true })).catch(() => {});

    // Pins that the fallback model was actually reached, so the assertion below cannot
    // pass because the run died before the second attempt existed.
    expect(prompts.length).toBe(2);
    expect(executions).toEqual(['finished']);

    const fallbackPrompt = JSON.stringify(prompts[1]);
    expect(fallbackPrompt).toContain('call-finished');
    expect(fallbackPrompt).toContain('answered-finished');
  });

  it('cancels eager work when an error chunk is answered with a retry', async () => {
    const withoutEager = await runErrorChunkRetryScenario(false);
    const withEager = await runErrorChunkRetryScenario(true);

    // The discarded attempt's call never runs at all without eager dispatch.
    expect(withoutEager).toEqual([]);
    // With it, the call had already started, so the guarantee is that it is cancelled
    // rather than left running to produce a side effect nothing will ever record.
    expect(withEager).toEqual(['execute-discarded', 'aborted-discarded']);
  });

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
            // Deliberately reuses the discarded attempt's toolCallId. Nothing may adopt
            // the cancelled execution's promise for it — this call has to run fresh.
            controller.enqueue({
              type: 'tool-call',
              toolCallId: 'call-discarded',
              toolName: 'tool-a',
              input: JSON.stringify({ value: 'retried' }),
            });
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
            // Event-driven rather than sleep-then-check, so the assertion turns on the
            // abort actually arriving and not on how fast CI is.
            if (signal) {
              await new Promise<void>(resolve => {
                if (signal.aborted) return resolve();
                signal.addEventListener('abort', () => resolve(), { once: true });
                setTimeout(resolve, 500);
              });
              if (signal.aborted) record(`aborted-${value}`);
            }
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
      }),
    ).catch(() => {});

    // Give any leaked eager execution time to surface rather than racing the assertion.
    await new Promise(resolve => setTimeout(resolve, 50));
    return events.filter(event => event.startsWith('execute-') || event.startsWith('aborted-'));
  }

  it('cancels eager work belonging to an attempt the pipeline discarded', async () => {
    const withoutEager = await runFallbackScenario(false);
    const withEager = await runFallbackScenario(true);

    // The normal pipeline never runs the discarded attempt's call at all — it only runs
    // the surviving attempt's call, which reuses the same toolCallId.
    expect(withoutEager).toEqual(['execute-retried']);

    // Eager dispatch had already started the discarded one, so the guarantee is
    // cancellation rather than absence: it is told to stop the moment its attempt is
    // thrown away. Crucially the surviving call still executes for real instead of
    // adopting the cancelled promise that shares its id.
    expect(withEager).toEqual(['execute-discarded', 'aborted-discarded', 'execute-retried']);
    expect(withEager).not.toContain('aborted-retried');
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
