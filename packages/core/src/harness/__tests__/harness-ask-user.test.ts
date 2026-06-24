/**
 * Tests the Harness integration for the agent-agnostic `ask_user` tool.
 *
 * `ask_user` pauses via the native tool-suspension primitive (it calls
 * `suspend({ question, options, selectionMode })`). The Harness surfaces that
 * pause through the generic `tool_suspended` event and resumes it via
 * `respondToToolSuspension({ toolCallId, resumeData })`, which feeds the user's
 * answer back into the suspended tool.
 */
import { describe, it, expect, vi } from 'vitest';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { askUserTool } from '../../tools/builtin/ask-user';

import { Harness } from '../harness';

vi.setConfig({ testTimeout: 30_000 });

function createAskUserToolCallStream(input: string, toolCallId = 'call-1') {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({
        type: 'tool-call',
        toolCallId,
        toolName: 'ask_user',
        input,
        providerExecuted: false,
      });
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

function createTextStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Thanks!' });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

async function buildHarness(id: string, input: string) {
  const agent = new Agent({
    id: `agent-${id}`,
    name: `Agent ${id}`,
    instructions: 'You ask the user questions.',
    model: new MastraLanguageModelV2Mock({
      doStream: (() => {
        let callCount = 0;
        return async () => {
          callCount++;
          return { stream: callCount === 1 ? createAskUserToolCallStream(input) : createTextStream() };
        };
      })(),
    }),
    tools: { ask_user: askUserTool },
  });

  const storage = new InMemoryStore();
  const mastra = new Mastra({ agents: { [`agent-${id}`]: agent }, logger: false, storage });
  const registeredAgent = mastra.getAgent(`agent-${id}`);

  const harness = new Harness({
    id: `harness-${id}`,
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
    initialState: { yolo: true } as any,
  });

  await harness.init();
  const session = await harness.createSession({ id: 'test-session', ownerId: 'test-owner' });
  await session.thread.create();
  return { harness, session, registeredAgent };
}

describe('Harness: ask_user native suspension', () => {
  it('emits tool_suspended carrying the question payload when ask_user suspends', async () => {
    const { session } = await buildHarness(
      'emit',
      JSON.stringify({
        question: 'Which environment?',
        options: [{ label: 'staging' }, { label: 'production' }],
      }),
    );

    const events: any[] = [];
    session.subscribe(event => events.push(event));

    await session.sendMessage({ content: 'Ask me where to deploy' });

    const suspendEvent = events.find(e => e.type === 'tool_suspended');
    expect(suspendEvent).toBeDefined();
    expect(suspendEvent.toolName).toBe('ask_user');
    expect(suspendEvent.toolCallId).toBe('call-1');
    expect(suspendEvent.suspendPayload.question).toBe('Which environment?');
    expect(suspendEvent.suspendPayload.options).toEqual([{ label: 'staging' }, { label: 'production' }]);
    expect(suspendEvent.suspendPayload.selectionMode).toBe('single_select');

    // Display state should reflect the pending suspension.
    expect(session.displayState.get().pendingSuspensions.get('call-1')?.toolCallId).toBe('call-1');
    expect(session.displayState.get().pendingSuspensions.get('call-1')?.toolName).toBe('ask_user');
  });

  it('resumes the suspended ask_user tool with the answer via respondToToolSuspension', async () => {
    const { session } = await buildHarness('resume', JSON.stringify({ question: 'Your name?' }));

    const events: any[] = [];
    session.subscribe(event => events.push(event));

    await session.sendMessage({ content: 'Ask my name' });

    const suspendEvent = events.find(e => e.type === 'tool_suspended');
    expect(suspendEvent).toBeDefined();

    events.length = 0;

    await session.respondToToolSuspension({ toolCallId: suspendEvent.toolCallId, resumeData: 'Ada' });

    // Wait for the resumed run to finish.
    await vi.waitFor(() => {
      const end = events.find(e => e.type === 'agent_end');
      expect(end?.reason).toBe('complete');
    });

    expect(events.some(e => e.type === 'error')).toBe(false);
    expect(session.displayState.get().pendingSuspensions.size).toBe(0);
  });

  it('emits multi_select in the suspend payload when requested', async () => {
    const { session } = await buildHarness(
      'multi',
      JSON.stringify({
        question: 'Pick any',
        options: [{ label: 'a' }, { label: 'b' }, { label: 'c' }],
        selectionMode: 'multi_select',
      }),
    );

    const events: any[] = [];
    session.subscribe(event => events.push(event));

    await session.sendMessage({ content: 'Ask me to pick' });

    const suspendEvent = events.find(e => e.type === 'tool_suspended');
    expect(suspendEvent.suspendPayload.selectionMode).toBe('multi_select');
  });

  it('keeps multiple pending suspensions and resumes the one selected by toolCallId (#13642)', async () => {
    // The agent only surfaces one suspension per step, but the harness must be able
    // to hold several pending suspensions at once and resume exactly the requested
    // one. Drive the toolCallId-keyed tracking directly to assert that selection.
    const { session } = await buildHarness('concurrent', JSON.stringify({ question: 'First?' }));

    const resumed: string[] = [];
    (session as any).resumeToolCall = async ({ toolCallId }: { toolCallId: string }) => {
      resumed.push(toolCallId);
      session.suspensions.delete({ toolCallId });
    };

    const pending = session.suspensions;
    pending.register({ toolCallId: 'call-a', runId: 'run-a', toolName: 'ask_user' });
    pending.register({ toolCallId: 'call-b', runId: 'run-b', toolName: 'ask_user' });

    // Explicit toolCallId resumes only that suspension; the other stays pending.
    await session.respondToToolSuspension({ toolCallId: 'call-b', resumeData: 'two' });
    expect(resumed).toEqual(['call-b']);
    expect(pending.has({ toolCallId: 'call-a' })).toBe(true);
    expect(pending.has({ toolCallId: 'call-b' })).toBe(false);

    // The remaining suspension can then be resumed by its own toolCallId.
    await session.respondToToolSuspension({ toolCallId: 'call-a', resumeData: 'one' });
    expect(resumed).toEqual(['call-b', 'call-a']);
    expect(pending.hasPending()).toBe(false);
  });

  it('resolves the sole pending suspension when toolCallId is omitted', async () => {
    const { session } = await buildHarness('sole', JSON.stringify({ question: 'Only?' }));

    const resumed: string[] = [];
    (session as any).resumeToolCall = async ({ toolCallId }: { toolCallId: string }) => {
      resumed.push(toolCallId);
      session.suspensions.delete({ toolCallId });
    };

    const pending = session.suspensions;
    pending.register({ toolCallId: 'call-only', runId: 'run-only', toolName: 'ask_user' });

    await session.respondToToolSuspension({ resumeData: 'ok' });
    expect(resumed).toEqual(['call-only']);

    // With more than one pending and no toolCallId, the call is a no-op.
    pending.register({ toolCallId: 'call-x', runId: 'run-x', toolName: 'ask_user' });
    pending.register({ toolCallId: 'call-y', runId: 'run-y', toolName: 'ask_user' });
    await session.respondToToolSuspension({ resumeData: 'ambiguous' });
    expect(resumed).toEqual(['call-only']);
    expect(pending.has({ toolCallId: 'call-x' })).toBe(true);
    expect(pending.has({ toolCallId: 'call-y' })).toBe(true);
  });

  it('clears pending suspensions on abort so the harness is no longer parked (and resume is a no-op)', async () => {
    // A run parked in a tool suspend() is not actively streaming, so abort() must
    // drop the pending suspensions itself — otherwise the harness reports it is
    // awaiting input forever and the UI can never recover.
    const { session } = await buildHarness('abort', JSON.stringify({ question: 'Pick?' }));

    let resumed = false;
    (session as any).resumeToolCall = async () => {
      resumed = true;
    };

    const pending = session.suspensions;
    pending.register({ toolCallId: 'call-a', runId: 'run-a', toolName: 'ask_user' });
    pending.register({ toolCallId: 'call-b', runId: 'run-b', toolName: 'ask_user' });
    expect(session.suspensions.hasPending()).toBe(true);

    session.abort();

    expect(session.suspensions.hasPending()).toBe(false);
    expect(pending.hasPending()).toBe(false);

    // Resuming a suspension that abort already dropped is a safe no-op.
    await session.respondToToolSuspension({ toolCallId: 'call-a', resumeData: 'late' });
    expect(resumed).toBe(false);
  });

  it('releases a parked tool-approval gate on abort (resolves as decline) so the run can finalize', async () => {
    // A run awaiting approval.arm() is not actively streaming, so abort() must
    // resolve the parked gate itself — otherwise the await never settles and the
    // run hangs. Resolving as a decline rejects the gated tool, which is correct
    // for an aborted run.
    const { session } = await buildHarness('approval-abort', JSON.stringify({ question: 'Pick?' }));

    const approval = session.approval;
    const parked = approval.arm({ toolName: 'edit_file' });
    expect(approval.isArmed()).toBe(true);

    session.abort();

    const decision = await parked;
    expect(decision.decision).toBe('decline');
    expect(approval.isArmed()).toBe(false);
  });

  it('surfaces three ask_user questions one at a time across resumes (#13642 serialized flow)', async () => {
    // When the model emits three ask_user calls in one step, suspend-capable tools
    // run sequentially: only the first suspends per run, and answering it resumes
    // the run so the next executes and suspends. The harness must therefore emit
    // exactly one tool_suspended per question, in order, with no replay — this is
    // the event sequence the TUI relies on to activate each prompt in turn.
    const questions = [
      { toolCallId: 'call-color', question: 'What is your favorite color?' },
      { toolCallId: 'call-size', question: 'Pick a size:' },
      { toolCallId: 'call-toppings', question: 'Pick toppings:' },
    ];

    const threeCallsStream = () =>
      new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
          for (const { toolCallId, question } of questions) {
            controller.enqueue({
              type: 'tool-call',
              toolCallId,
              toolName: 'ask_user',
              input: JSON.stringify({ question }),
              providerExecuted: false,
            });
          }
          controller.enqueue({
            type: 'finish',
            finishReason: 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          });
          controller.close();
        },
      });

    const agent = new Agent({
      id: 'agent-serial',
      name: 'Agent Serial',
      instructions: 'You ask the user questions.',
      model: new MastraLanguageModelV2Mock({
        doStream: (() => {
          let callCount = 0;
          return async () => {
            callCount++;
            return { stream: callCount === 1 ? threeCallsStream() : createTextStream() };
          };
        })(),
      }),
      tools: { ask_user: askUserTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({ agents: { 'agent-serial': agent }, logger: false, storage });
    const registeredAgent = mastra.getAgent('agent-serial');
    const harness = new Harness({
      id: 'harness-serial',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await harness.init();
    const session = await harness.createSession({ id: 'test-session', ownerId: 'test-owner' });
    await session.thread.create();

    const events: any[] = [];
    session.subscribe(event => events.push(event));

    await session.sendMessage({ content: 'Ask me three things' });

    // Only the first question suspends on the initial run.
    let suspensions = events.filter(e => e.type === 'tool_suspended');
    expect(suspensions.map(e => e.toolCallId)).toEqual(['call-color']);

    // Answering each question resumes the run and surfaces exactly the next one.
    for (let i = 0; i < questions.length; i++) {
      events.length = 0;
      await session.respondToToolSuspension({ toolCallId: questions[i].toolCallId, resumeData: 'answer' });

      suspensions = events.filter(e => e.type === 'tool_suspended');
      const next = questions[i + 1];
      if (next) {
        // The next question suspends — and the resume must NOT replay tool_start
        // for already-streamed calls (no duplicate streamed boxes in the TUI).
        expect(suspensions.map(e => e.toolCallId)).toEqual([next.toolCallId]);
        expect(events.some(e => e.type === 'tool_start')).toBe(false);
      } else {
        // Last answer completes the run with no further suspensions. The resume
        // call returns once the matching tool result boundary is observed, so the
        // final agent_end may arrive on the subscription shortly after.
        expect(suspensions).toHaveLength(0);
        await vi.waitFor(() => {
          expect(events.some(e => e.type === 'agent_end' && e.reason === 'complete')).toBe(true);
        });
      }
    }

    expect(session.displayState.get().pendingSuspensions.size).toBe(0);
  });
});
