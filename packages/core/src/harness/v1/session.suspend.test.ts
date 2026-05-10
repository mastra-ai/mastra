/**
 * Harness v1 — Session suspend/resume flow.
 *
 * Covers:
 *   - message() captures `pendingResume` when finishReason === 'suspended'
 *   - The four typed `respond*` methods classify by chunk + tool name
 *   - Wrong-kind / no-pending / already-resumed rejections
 *   - plan-approval mode flip applied atomically with the pending clear
 *   - Re-suspension chain (resume → suspend again → resume) round-trips
 */

import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import type { MastraModelOutput } from '../../stream/base/output';

import { HarnessValidationError } from './errors';
import { Harness } from './harness';

// ---------------------------------------------------------------------------
// Fake agent with stub stream/generate/resumeStream + a queue of "next runs"
// so a single test can stage suspend → resume → suspend chains.
// ---------------------------------------------------------------------------

interface RunSpec {
  finishReason: string;
  suspendPayload?:
    | {
        toolCallId: string;
        toolName: string;
        args?: unknown;
        suspendPayload?: unknown;
        resumeSchema?: string;
      }
    | undefined;
  text?: string;
  runId?: string;
}

interface ResumeCall {
  resumeData: unknown;
  options: { runId?: string; toolCallId?: string; abortSignal?: AbortSignal };
}

class FakeAgent extends Agent<any, any, any> {
  /** Each entry is consumed in order by stream() / resumeStream() / generate(). */
  runs: RunSpec[] = [];
  streamCalls: { messages: unknown; options: any }[] = [];
  resumeCalls: ResumeCall[] = [];

  constructor() {
    super({
      id: 'fake',
      name: 'fake',
      instructions: 'fake',
      model: 'openai/gpt-4o-mini' as any,
    });
  }

  /** Push a run that will be returned by the next stream/resumeStream/generate. */
  enqueueRun(spec: RunSpec): void {
    this.runs.push({ runId: 'fake-run', text: 'ok', ...spec });
  }

  private buildOutput(spec: RunSpec): MastraModelOutput {
    const fullOutput = {
      text: spec.text ?? '',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      finishReason: spec.finishReason,
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
      response: { id: 'r', timestamp: new Date(), modelId: 'fake', messages: [], uiMessages: [] },
      totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      error: undefined,
      tripwire: undefined,
      traceId: undefined,
      spanId: undefined,
      runId: spec.runId,
      suspendPayload: spec.suspendPayload,
      messages: [],
      rememberedMessages: [],
    };
    return {
      runId: spec.runId,
      getFullOutput: async () => fullOutput,
    } as unknown as MastraModelOutput;
  }

  async stream(_messages: any, _options?: any): Promise<any> {
    this.streamCalls.push({ messages: _messages, options: _options });
    const spec = this.runs.shift();
    if (!spec) throw new Error('FakeAgent: no run enqueued for stream()');
    return this.buildOutput(spec);
  }

  async generate(_messages: any, _options?: any): Promise<any> {
    const spec = this.runs.shift();
    if (!spec) throw new Error('FakeAgent: no run enqueued for generate()');
    const out = this.buildOutput(spec);
    return await out.getFullOutput();
  }

  async resumeStream(resumeData: any, options?: any): Promise<any> {
    this.resumeCalls.push({ resumeData, options });
    const spec = this.runs.shift();
    if (!spec) throw new Error('FakeAgent: no run enqueued for resumeStream()');
    return this.buildOutput(spec);
  }
}

function setup(modes?: any) {
  const agent = new FakeAgent();
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const resolvedModes = modes ?? [{ id: 'default', agentId: 'default' }];
  const harness = new Harness({
    agents: { default: agent } as any,
    modes: resolvedModes,
    defaultModeId: resolvedModes[0].id,
    sessions: { storage },
  });
  return { harness, agent, storage };
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

describe('Session — suspend capture on message()', () => {
  it('writes pendingResume with kind "tool-approval" for a plain approval suspend', async () => {
    const { harness, agent } = setup();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-A',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'rm -rf /' } },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const result = await session.message({ content: 'do it' });

    expect(result.finishReason).toBe('suspended');
    const pending = session.getRecord().pendingResume;
    expect(pending).toBeDefined();
    expect(pending!.kind).toBe('tool-approval');
    expect(pending!.runId).toBe('run-A');
    expect(pending!.toolCallId).toBe('tc-1');
    expect(pending!.toolName).toBe('shell');
    expect(pending!.payload).toEqual({ input: { cmd: 'rm -rf /' } });
    expect(session.getDisplayState().pending?.kind).toBe('tool-approval');
  });

  it('classifies as "tool-suspension" when the chunk carries a suspendPayload field', async () => {
    const { harness, agent } = setup();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-B',
      suspendPayload: {
        toolCallId: 'tc-2',
        toolName: 'long_running',
        args: { x: 1 },
        suspendPayload: { progress: 42 },
      },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await session.message({ content: 'go' });

    const pending = session.getRecord().pendingResume!;
    expect(pending.kind).toBe('tool-suspension');
    expect(pending.payload).toEqual({ input: { x: 1 }, suspendData: { progress: 42 } });
    expect(session.getDisplayState().pending?.kind).toBe('tool-suspension');
  });

  it('classifies as "question" when the tool name is ask_user', async () => {
    const { harness, agent } = setup();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-C',
      suspendPayload: {
        toolCallId: 'tc-3',
        toolName: 'ask_user',
        args: {
          question: 'pick a color',
          options: [{ label: 'red' }, { label: 'blue' }],
          selectionMode: 'single_select',
        },
      },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await session.message({ content: 'choose' });

    const pending = session.getRecord().pendingResume!;
    expect(pending.kind).toBe('question');
    expect(pending.payload).toEqual({
      question: 'pick a color',
      options: [{ label: 'red' }, { label: 'blue' }],
      selectionMode: 'single_select',
    });
    expect(session.getDisplayState().pending?.kind).toBe('question');
  });

  it('classifies as "plan-approval" when the tool name is submit_plan, freezing transitionsTo', async () => {
    const { harness, agent } = setup([
      { id: 'planner', agentId: 'default', transitionsTo: 'builder' },
      { id: 'builder', agentId: 'default' },
    ]);
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-D',
      suspendPayload: {
        toolCallId: 'tc-4',
        toolName: 'submit_plan',
        args: { title: 'Refactor X', plan: 'do A then B' },
      },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.switchMode({ mode: 'planner' });

    await session.message({ content: 'plan it' });

    const pending = session.getRecord().pendingResume!;
    expect(pending.kind).toBe('plan-approval');
    expect(pending.payload).toEqual({ title: 'Refactor X', plan: 'do A then B' });
    expect(pending.transitionModeId).toBe('builder');
    expect(session.getDisplayState().pending?.kind).toBe('plan-approval');
  });

  it('does not write pendingResume when finishReason is not "suspended"', async () => {
    const { harness, agent } = setup();
    agent.enqueueRun({ finishReason: 'stop', text: 'done' });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await session.message({ content: 'hi' });

    expect(session.getRecord().pendingResume).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Resume — happy path
// ---------------------------------------------------------------------------

describe('Session — respondToToolApproval / Suspension / Question / PlanApproval', () => {
  it('respondToToolApproval calls agent.resumeStream and clears pendingResume', async () => {
    const { harness, agent } = setup();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-A',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.message({ content: 'go' });

    agent.enqueueRun({ finishReason: 'stop', runId: 'run-A', text: 'done' });

    const result = await session.respondToToolApproval({ approved: true });

    expect(result.text).toBe('done');
    expect(result.finishReason).toBe('stop');
    expect(agent.resumeCalls).toHaveLength(1);
    expect(agent.resumeCalls[0]!.resumeData).toEqual({ approved: true });
    expect(agent.resumeCalls[0]!.options).toMatchObject({ runId: 'run-A', toolCallId: 'tc-1' });
    expect(agent.resumeCalls[0]!.options.abortSignal).toBeInstanceOf(AbortSignal);
    expect(session.getRecord().pendingResume).toBeUndefined();
    expect(session.getDisplayState().pending).toBeNull();
  });

  it('respondToToolSuspension forwards opaque resumeData', async () => {
    const { harness, agent } = setup();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-S',
      suspendPayload: {
        toolCallId: 'tc-S',
        toolName: 'long',
        args: {},
        suspendPayload: { step: 'A' },
      },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.message({ content: 'go' });

    agent.enqueueRun({ finishReason: 'stop', runId: 'run-S' });
    await session.respondToToolSuspension({ resumeData: { result: 'ok' } });

    expect(agent.resumeCalls[0]!.resumeData).toEqual({ result: 'ok' });
    expect(session.getRecord().pendingResume).toBeUndefined();
  });

  it('respondToQuestion forwards { answer }', async () => {
    const { harness, agent } = setup();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-Q',
      suspendPayload: {
        toolCallId: 'tc-Q',
        toolName: 'ask_user',
        args: { question: 'pick' },
      },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.message({ content: 'go' });

    agent.enqueueRun({ finishReason: 'stop', runId: 'run-Q' });
    await session.respondToQuestion({ answer: 'red' });

    expect(agent.resumeCalls[0]!.resumeData).toEqual({ answer: 'red' });
  });

  it('respondToPlanApproval flips active mode atomically when approved + transitionsTo set', async () => {
    const { harness, agent } = setup([
      { id: 'planner', agentId: 'default', transitionsTo: 'builder' },
      { id: 'builder', agentId: 'default' },
    ]);
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-P',
      suspendPayload: { toolCallId: 'tc-P', toolName: 'submit_plan', args: { title: 't', plan: 'p' } },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.switchMode({ mode: 'planner' });
    await session.message({ content: 'plan' });

    expect(session.getCurrentMode().id).toBe('planner');

    agent.enqueueRun({ finishReason: 'stop', runId: 'run-P' });
    await session.respondToPlanApproval({ approved: true });

    expect(session.getCurrentMode().id).toBe('builder');
    expect(session.getRecord().pendingResume).toBeUndefined();
  });

  it('respondToPlanApproval does NOT flip mode when rejected', async () => {
    const { harness, agent } = setup([
      { id: 'planner', agentId: 'default', transitionsTo: 'builder' },
      { id: 'builder', agentId: 'default' },
    ]);
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-P',
      suspendPayload: { toolCallId: 'tc-P', toolName: 'submit_plan', args: { title: 't', plan: 'p' } },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.switchMode({ mode: 'planner' });
    await session.message({ content: 'plan' });

    agent.enqueueRun({ finishReason: 'stop', runId: 'run-P' });
    await session.respondToPlanApproval({ approved: false });

    expect(session.getCurrentMode().id).toBe('planner');
  });

  it('captures a follow-on suspend produced by the resumed run', async () => {
    const { harness, agent } = setup();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-1',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: {} },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.message({ content: 'go' });

    // Resume returns ANOTHER suspend.
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-1',
      suspendPayload: { toolCallId: 'tc-2', toolName: 'shell', args: {} },
    });
    const result = await session.respondToToolApproval({ approved: true });

    expect(result.finishReason).toBe('suspended');
    const pending = session.getRecord().pendingResume!;
    expect(pending.toolCallId).toBe('tc-2');
    expect(pending.kind).toBe('tool-approval');

    // Second respond resolves cleanly.
    agent.enqueueRun({ finishReason: 'stop', runId: 'run-1' });
    await session.respondToToolApproval({ approved: true });
    expect(session.getRecord().pendingResume).toBeUndefined();
    expect(agent.resumeCalls).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Resume — rejection cases
// ---------------------------------------------------------------------------

// One descriptor per responder so the four rejection paths can be
// exercised uniformly by every public entry point.
type Kind = 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval';

interface Responder {
  /** Kind that, when pending, this responder is the *correct* one to call. */
  kind: Kind;
  /** Suspend chunk that produces a pendingResume of this kind. */
  enqueueSuspend: (agent: FakeAgent) => void;
  /** Call the public method on Session with kind-shaped resumeData. */
  call: (s: any) => Promise<unknown>;
  label: string;
}

const responders: Responder[] = [
  {
    kind: 'tool-approval',
    label: 'respondToToolApproval',
    enqueueSuspend: agent =>
      agent.enqueueRun({
        finishReason: 'suspended',
        runId: 'run-A',
        suspendPayload: { toolCallId: 'tc', toolName: 'shell', args: {} },
      }),
    call: s => s.respondToToolApproval({ approved: true }),
  },
  {
    kind: 'tool-suspension',
    label: 'respondToToolSuspension',
    enqueueSuspend: agent =>
      agent.enqueueRun({
        finishReason: 'suspended',
        runId: 'run-S',
        suspendPayload: {
          toolCallId: 'tc',
          toolName: 'long',
          args: {},
          suspendPayload: { step: 'A' },
        },
      }),
    call: s => s.respondToToolSuspension({ resumeData: { ok: true } }),
  },
  {
    kind: 'question',
    label: 'respondToQuestion',
    enqueueSuspend: agent =>
      agent.enqueueRun({
        finishReason: 'suspended',
        runId: 'run-Q',
        suspendPayload: { toolCallId: 'tc', toolName: 'ask_user', args: { question: 'pick' } },
      }),
    call: s => s.respondToQuestion({ answer: 'red' }),
  },
  {
    kind: 'plan-approval',
    label: 'respondToPlanApproval',
    enqueueSuspend: agent =>
      agent.enqueueRun({
        finishReason: 'suspended',
        runId: 'run-P',
        suspendPayload: { toolCallId: 'tc', toolName: 'submit_plan', args: { title: 't', plan: 'p' } },
      }),
    call: s => s.respondToPlanApproval({ approved: true }),
  },
];

describe('Session — respond* rejection paths (all responders)', () => {
  it.each(responders)('$label rejects when nothing is pending', async ({ call }) => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await expect(call(session)).rejects.toBeInstanceOf(HarnessValidationError);
  });

  // Build every (pending-kind, responder) pair where pending != responder.kind
  // so wrong-kind is exercised on all four responders.
  const wrongKindMatrix = responders.flatMap(responder =>
    responders.filter(p => p.kind !== responder.kind).map(pending => ({ responder, pending })),
  );

  it.each(wrongKindMatrix)(
    '$responder.label rejects when pending kind is "$pending.kind"',
    async ({ responder, pending }) => {
      const { harness, agent } = setup();
      pending.enqueueSuspend(agent);
      const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
      await session.message({ content: 'go' });

      await expect(responder.call(session)).rejects.toBeInstanceOf(HarnessValidationError);
      // Pending record is left untouched so the correct responder can still resolve it.
      expect(session.getRecord().pendingResume!.kind).toBe(pending.kind);
      expect(agent.resumeCalls).toHaveLength(0);
    },
  );

  it.each(responders)(
    '$label rejects when pendingResume.resumedAt is already set (in-flight)',
    async ({ enqueueSuspend, call }) => {
      const { harness, agent, storage } = setup();
      enqueueSuspend(agent);
      const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
      await session.message({ content: 'go' });

      // Simulate a crash mid-resume by poking resumedAt directly into storage.
      const rec = (await storage.loadSession({ sessionId: session.id }))!;
      await storage.saveSession(
        {
          ...rec,
          pendingResume: { ...rec.pendingResume!, resumedAt: Date.now() },
        },
        { ownerId: session._internalOwnerId, ifVersion: rec.version },
      );
      // Re-hydrate so the next call sees the persisted marker.
      await harness.shutdown();
      const harness2 = new Harness({
        agents: { default: agent } as any,
        modes: [{ id: 'default', agentId: 'default' }],
        defaultModeId: 'default',
        sessions: { storage },
      });
      const session2 = await harness2.session({ sessionId: session.id, resourceId: 'u' });

      await expect(call(session2)).rejects.toBeInstanceOf(HarnessValidationError);
      expect(agent.resumeCalls).toHaveLength(0);
    },
  );

  it.each(responders)('$label rejects on a closed session', async ({ enqueueSuspend, call }) => {
    const { harness, agent } = setup();
    enqueueSuspend(agent);
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.message({ content: 'go' });
    await session.close();

    await expect(call(session)).rejects.toThrow(/closed/);
  });
});
