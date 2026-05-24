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
import { InMemoryStore } from '../../storage/mock';
import type { MastraModelOutput } from '../../stream/base/output';
import { buildFakeOutput } from './__test-utils__/fake-output';

import { HarnessInboxResponseConflictError, HarnessSessionDeletedError, HarnessValidationError } from './errors';
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
  holdUntil?: Promise<void>;
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

  private buildOutput(spec: RunSpec, runIdOverride?: string): MastraModelOutput {
    const runId = runIdOverride ?? spec.runId;
    return buildFakeOutput({
      runId,
      fullOutput: {
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
        suspendPayload: spec.suspendPayload,
        messages: [],
        rememberedMessages: [],
      },
    });
  }

  async stream(_messages: any, options?: any): Promise<any> {
    this.streamCalls.push({ messages: _messages, options });
    const spec = this.runs.shift();
    if (!spec) throw new Error('FakeAgent: no run enqueued for stream()');
    await spec.holdUntil;
    const out = this.buildOutput(spec, options?.runId);
    this._internalRegisterStreamRun(out, (options ?? {}) as any);
    return out;
  }

  async generate(_messages: any, _options?: any): Promise<any> {
    const spec = this.runs.shift();
    if (!spec) throw new Error('FakeAgent: no run enqueued for generate()');
    await spec.holdUntil;
    const out = this.buildOutput(spec);
    return await out.getFullOutput();
  }

  async resumeStream(resumeData: any, options?: any): Promise<any> {
    this.resumeCalls.push({ resumeData, options });
    const spec = this.runs.shift();
    if (!spec) throw new Error('FakeAgent: no run enqueued for resumeStream()');
    await spec.holdUntil;
    const out = this.buildOutput(spec, options?.runId);
    this._internalRegisterStreamRun(out, (options ?? {}) as any);
    return out;
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

async function waitFor(predicate: () => boolean, label: string, timeoutMs = 500): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for ${label}`);
    }
    await new Promise(resolve => setImmediate(resolve));
  }
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
    // Signal-routed message() stamps the runtime-allocated runId on the
    // resulting MastraModelOutput; pending capture mirrors it. The test's
    // enqueued `runId: 'run-A'` is overridden in the same way real
    // Agent.stream() honours options.runId.
    expect(pending!.runId).toBe(result.runId);
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
    expect(pending.itemId).toBe('question:tc-3');
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
    expect(pending.itemId).toBe('plan-approval:tc-4');
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

  it('persists a message mode override on pendingResume and resumes through that mode', async () => {
    const agentA = new FakeAgent();
    const agentB = new FakeAgent();
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const harness = new Harness({
      agents: { agentA, agentB } as any,
      modes: [
        { id: 'modeA', agentId: 'agentA' },
        { id: 'modeB', agentId: 'agentB' },
      ],
      defaultModeId: 'modeA',
      sessions: { storage },
    });
    agentB.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-mode-b',
      suspendPayload: { toolCallId: 'tc-mode-b', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await session.message({ content: 'use mode b', mode: 'modeB' });

    expect(session.getRecord().pendingResume).toMatchObject({
      modeId: 'modeB',
    });
    expect(agentB.streamCalls).toHaveLength(1);
    expect(agentA.streamCalls).toHaveLength(0);

    agentB.enqueueRun({ finishReason: 'stop', runId: 'run-mode-b', text: 'resumed on mode b' });
    const result = await session.respondToToolApproval({ approved: true });

    expect(result.text).toBe('resumed on mode b');
    expect(agentB.resumeCalls).toHaveLength(1);
    expect(agentA.resumeCalls).toHaveLength(0);
  });

  it('keeps a question registered by the tool before suspend capture', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await (session as any)._registerQuestion({
      questionId: 'tc-registered',
      question: 'registered prompt',
      options: [{ label: 'yes' }],
      selectionMode: 'single_select',
      runId: 'run-registered',
      toolCallId: 'tc-registered',
    });
    await (session as any)._maybeCaptureSuspend({
      runId: 'run-registered',
      finishReason: 'suspended',
      suspendPayload: {
        toolCallId: 'tc-registered',
        toolName: 'ask_user',
        args: { question: 'stale prompt' },
      },
    });

    const pending = session.getRecord().pendingResume!;
    expect(pending.kind).toBe('question');
    expect(pending.itemId).toBe('tc-registered');
    expect(pending.modeId).toBe('default');
    expect(pending.payload).toEqual({
      question: 'registered prompt',
      options: [{ label: 'yes' }],
      selectionMode: 'single_select',
    });
  });

  it('keeps a registered question when suspend capture reports a generic tool suspension', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await (session as any)._registerQuestion({
      questionId: 'sandbox-registered',
      question: 'Allow access?',
      options: [{ label: 'yes' }],
      selectionMode: 'single_select',
      runId: 'run-sandbox',
      toolCallId: 'tc-sandbox',
    });
    await (session as any)._maybeCaptureSuspend({
      runId: 'run-sandbox',
      finishReason: 'suspended',
      suspendPayload: {
        toolCallId: 'tc-sandbox',
        toolName: 'request_access',
        suspendPayload: {},
      },
    });

    const pending = session.getRecord().pendingResume!;
    expect(pending.kind).toBe('question');
    expect(pending.itemId).toBe('sandbox-registered');
    expect(pending.toolCallId).toBe('tc-sandbox');
    expect(pending.payload).toEqual({
      question: 'Allow access?',
      options: [{ label: 'yes' }],
      selectionMode: 'single_select',
    });
  });

  it('keeps a plan approval registered by the tool before suspend capture', async () => {
    const { harness } = setup([
      { id: 'planner', agentId: 'default', transitionsTo: 'builder' },
      { id: 'builder', agentId: 'default' },
    ]);
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.switchMode({ mode: 'planner' });

    await (session as any)._registerPlanApproval({
      planId: 'tc-plan',
      title: 'registered title',
      plan: 'registered plan',
      runId: 'run-plan',
      toolCallId: 'tc-plan',
      modeId: 'planner',
    });
    await (session as any)._maybeCaptureSuspend({
      runId: 'run-plan',
      finishReason: 'suspended',
      suspendPayload: {
        toolCallId: 'tc-plan',
        toolName: 'submit_plan',
        args: { title: 'stale title', plan: 'stale plan' },
      },
    });

    const pending = session.getRecord().pendingResume!;
    expect(pending.kind).toBe('plan-approval');
    expect(pending.itemId).toBe('tc-plan');
    expect(pending.modeId).toBe('planner');
    expect(pending.payload).toEqual({ title: 'registered title', plan: 'registered plan' });
    expect(pending.transitionModeId).toBe('builder');
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
    const first = await session.message({ content: 'go' });

    agent.enqueueRun({ finishReason: 'stop', runId: first.runId, text: 'done' });

    const result = await session.respondToToolApproval({ approved: true });

    expect(result.text).toBe('done');
    expect(result.finishReason).toBe('stop');
    expect(agent.resumeCalls).toHaveLength(1);
    expect(agent.resumeCalls[0]!.resumeData).toEqual({ approved: true });
    expect(agent.resumeCalls[0]!.options).toMatchObject({ runId: first.runId, toolCallId: 'tc-1' });
    expect(agent.resumeCalls[0]!.options.abortSignal).toBeInstanceOf(AbortSignal);
    expect(session.getRecord().pendingResume).toBeUndefined();
    expect(session.getDisplayState().pending).toBeNull();
  });

  it('respondToToolApproval records denial receipts and forwards reason', async () => {
    const { harness, agent } = setup();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-deny',
      suspendPayload: { toolCallId: 'tc-deny', toolName: 'shell', args: { cmd: 'rm' } },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.message({ content: 'go' });

    agent.enqueueRun({ finishReason: 'stop', runId: 'run-deny', text: 'denied' });
    const receipt = await session.respondToToolApproval({
      approved: false,
      reason: 'needs review',
      responseId: 'deny-response-1',
    });

    expect(receipt).toEqual({
      itemId: 'tool-approval:tc-deny',
      kind: 'tool-approval',
      status: 'applied',
      responseId: 'deny-response-1',
      duplicate: false,
    });
    expect(agent.resumeCalls[0]!.resumeData).toEqual({ approved: false, reason: 'needs review' });
    expect(session.getRecord().inboxResponseReceipts?.['deny-response-1']).toMatchObject({
      itemId: 'tool-approval:tc-deny',
      kind: 'tool-approval',
      resumeAttemptId: 'deny-response-1',
      status: 'applied',
      response: { approved: false, reason: 'needs review' },
      result: expect.objectContaining({ text: 'denied' }),
    });
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

  it('respondToToolSuspension without responseId preserves legacy opaque resumeData behavior', async () => {
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

    const resumeData = { completedAt: new Date('2026-05-15T00:00:00.000Z') };
    agent.enqueueRun({ finishReason: 'stop', runId: 'run-S', text: 'done' });
    const result = await session.respondToToolSuspension({ resumeData });

    expect(result.text).toBe('done');
    expect(agent.resumeCalls[0]!.resumeData).toBe(resumeData);
    expect(session.getRecord().inboxResponseReceipts).toBeUndefined();
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

  it('fails closed when a recovered question resume observes mode-to-agent binding drift', async () => {
    const storage = new InMemoryStore();
    const harnessStore = await storage.getStore('harness');
    if (!harnessStore) throw new Error('expected harness storage');
    const sessionId = 'sess-question-agent-drift';
    const requestedAt = Date.now();
    await harnessStore.saveSession(
      {
        harnessName: 'default',
        id: sessionId,
        resourceId: 'u',
        threadId: 't-question-agent-drift',
        origin: 'top-level',
        ownsThread: false,
        modeId: 'default',
        modelId: 'default',
        subagentModelOverrides: {},
        permissionRules: { categories: {}, tools: {} },
        sessionGrants: { categories: [], tools: [] },
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        pendingQueue: [],
        pendingResume: {
          kind: 'question',
          itemId: 'question:tc-Q',
          runId: 'run-Q',
          toolCallId: 'tc-Q',
          toolName: 'ask_user',
          source: 'parent',
          requestedAt,
          modeId: 'default',
          runtimeDependencies: { modeId: 'default', agentId: 'old-agent', modelId: 'default' },
          payload: { question: 'pick' },
        },
        state: undefined,
        createdAt: requestedAt,
        lastActivityAt: requestedAt,
        version: 0,
      },
      { harnessName: 'default', ifVersion: 0 },
    );
    const agent = new FakeAgent();
    const harness = new Harness({
      agents: { default: agent } as any,
      storage,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });

    const session = await harness.session({ sessionId });
    await expect(
      session.respondToQuestion({ itemId: 'question:tc-Q', responseId: 'answer-1', answer: 'red' }),
    ).rejects.toMatchObject({ code: 'harness.runtime_dependency_drifted' });

    expect(agent.resumeCalls).toHaveLength(0);
    expect(session.getRecord().inboxResponseReceipts?.['answer-1']).toMatchObject({
      status: 'failed',
      error: { code: 'harness.runtime_dependency_drifted' },
    });
    expect(session.getRecord().pendingResume).toMatchObject({ runId: 'run-Q' });
    expect(session.getRecord().pendingResume?.resumedAt).toBeUndefined();
  });

  it('fails closed when a recovered question resume observes runtime compatibility generation drift', async () => {
    const storage = new InMemoryStore();
    const harnessStore = await storage.getStore('harness');
    if (!harnessStore) throw new Error('expected harness storage');
    const sessionId = 'sess-question-generation-drift';
    const requestedAt = Date.now();
    await harnessStore.saveSession(
      {
        harnessName: 'default',
        id: sessionId,
        resourceId: 'u',
        threadId: 't-question-generation-drift',
        origin: 'top-level',
        ownsThread: false,
        modeId: 'default',
        modelId: 'default',
        subagentModelOverrides: {},
        permissionRules: { categories: {}, tools: {} },
        sessionGrants: { categories: [], tools: [] },
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        pendingQueue: [],
        pendingResume: {
          kind: 'question',
          itemId: 'question:tc-Q-generation',
          runId: 'run-Q-generation',
          toolCallId: 'tc-Q-generation',
          toolName: 'ask_user',
          source: 'parent',
          requestedAt,
          modeId: 'default',
          runtimeDependencies: {
            modeId: 'default',
            agentId: 'default',
            modelId: 'default',
            runtimeCompatibilityGeneration: 'generation-a',
          },
          payload: { question: 'pick' },
        },
        state: undefined,
        createdAt: requestedAt,
        lastActivityAt: requestedAt,
        version: 0,
      },
      { harnessName: 'default', ifVersion: 0 },
    );
    const agent = new FakeAgent();
    const harness = new Harness({
      agents: { default: agent } as any,
      storage,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      runtimeCompatibilityGeneration: 'generation-b',
    });

    const session = await harness.session({ sessionId });
    await expect(
      session.respondToQuestion({ itemId: 'question:tc-Q-generation', responseId: 'answer-generation', answer: 'red' }),
    ).rejects.toMatchObject({ code: 'harness.runtime_dependency_drifted' });

    expect(agent.resumeCalls).toHaveLength(0);
    expect(session.getRecord().inboxResponseReceipts?.['answer-generation']).toMatchObject({
      status: 'failed',
      error: {
        code: 'harness.runtime_dependency_drifted',
        message: expect.stringContaining('runtime_compatibility_generation "generation-a"'),
      },
    });
    expect(session.getRecord().pendingResume).toMatchObject({ runId: 'run-Q-generation' });
    expect(session.getRecord().pendingResume?.resumedAt).toBeUndefined();
  });

  it('rejects an active question resume when the live session is marked deleted', async () => {
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

    let releaseFullOutput!: () => void;
    const fullOutput = new Promise<unknown>(resolve => {
      releaseFullOutput = () => resolve({});
    });
    agent.resumeStream = async (resumeData: any, options?: any) => {
      agent.resumeCalls.push({ resumeData, options });
      return { getFullOutput: () => fullOutput };
    };
    const response = session.respondToQuestion({ itemId: 'question:tc-Q', responseId: 'answer-1', answer: 'red' });
    await waitFor(() => session.isRunning(), 'active resume turn start');
    const idle = session.waitForIdle();

    (session as any)._markDeleted();

    expect(session.isRunning()).toBe(false);
    try {
      await expect(response).rejects.toBeInstanceOf(HarnessSessionDeletedError);
      await expect(idle).rejects.toBeInstanceOf(HarnessSessionDeletedError);
      await expect(session.setState({ afterDelete: true })).rejects.toBeInstanceOf(HarnessSessionDeletedError);
    } finally {
      releaseFullOutput();
    }
  });

  it('respondToQuestion returns duplicate receipt without resuming twice', async () => {
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
    const first = await session.respondToQuestion({ itemId: 'question:tc-Q', responseId: 'answer-1', answer: 'red' });
    const duplicate = await session.respondToQuestion({
      itemId: 'question:tc-Q',
      responseId: 'answer-1',
      answer: 'red',
    });

    expect(first).toMatchObject({ status: 'applied', duplicate: false, responseId: 'answer-1' });
    expect(duplicate).toMatchObject({ status: 'applied', duplicate: true, responseId: 'answer-1' });
    expect(agent.resumeCalls).toHaveLength(1);
  });

  it('respondToQuestion serializes concurrent duplicate responseIds before resuming', async () => {
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

    let release!: () => void;
    const holdUntil = new Promise<void>(resolve => {
      release = resolve;
    });
    agent.enqueueRun({ finishReason: 'stop', runId: 'run-Q', holdUntil });

    const first = session.respondToQuestion({ itemId: 'question:tc-Q', responseId: 'answer-1', answer: 'red' });
    const second = session.respondToQuestion({ itemId: 'question:tc-Q', responseId: 'answer-1', answer: 'red' });

    await new Promise(resolve => setImmediate(resolve));
    expect(agent.resumeCalls).toHaveLength(1);

    release();
    await expect(first).resolves.toMatchObject({ status: 'applied', duplicate: false, responseId: 'answer-1' });
    await expect(second).resolves.toMatchObject({ status: 'accepted', duplicate: true, responseId: 'answer-1' });
    expect(agent.resumeCalls).toHaveLength(1);
  });

  it('respondToQuestion rejects concurrent distinct responseIds after one response wins admission', async () => {
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

    let release!: () => void;
    const holdUntil = new Promise<void>(resolve => {
      release = resolve;
    });
    agent.enqueueRun({ finishReason: 'stop', runId: 'run-Q', holdUntil });

    const first = session.respondToQuestion({ itemId: 'question:tc-Q', responseId: 'answer-1', answer: 'red' });
    const second = session
      .respondToQuestion({ itemId: 'question:tc-Q', responseId: 'answer-2', answer: 'red' })
      .catch(err => err);

    await new Promise(resolve => setImmediate(resolve));
    await expect(second).resolves.toMatchObject({
      message: expect.stringContaining('pending resume already responded; awaiting agent confirmation'),
    });
    expect(agent.resumeCalls).toHaveLength(1);

    release();
    await expect(first).resolves.toMatchObject({ status: 'applied', duplicate: false, responseId: 'answer-1' });
    expect(session.getRecord().inboxResponseReceipts?.['answer-2']).toBeUndefined();
  });

  it('respondToQuestion returns accepted duplicate receipt while resume is in flight', async () => {
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

    let release!: () => void;
    const holdUntil = new Promise<void>(resolve => {
      release = resolve;
    });
    agent.enqueueRun({ finishReason: 'stop', runId: 'run-Q', holdUntil });

    const first = session.respondToQuestion({ itemId: 'question:tc-Q', responseId: 'answer-1', answer: 'red' });
    await new Promise(resolve => setImmediate(resolve));

    const duplicate = await session.respondToQuestion({
      itemId: 'question:tc-Q',
      responseId: 'answer-1',
      answer: 'red',
    });

    expect(duplicate).toMatchObject({ status: 'accepted', duplicate: true, responseId: 'answer-1' });
    expect(agent.resumeCalls).toHaveLength(1);

    release();
    await expect(first).resolves.toMatchObject({ status: 'applied', duplicate: false, responseId: 'answer-1' });
  });

  it('respondToQuestion rejects same responseId with different answer', async () => {
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
    await session.respondToQuestion({ itemId: 'question:tc-Q', responseId: 'answer-1', answer: 'red' });

    await expect(
      session.respondToQuestion({ itemId: 'question:tc-Q', responseId: 'answer-1', answer: 'blue' }),
    ).rejects.toBeInstanceOf(HarnessInboxResponseConflictError);
    expect(agent.resumeCalls).toHaveLength(1);
  });

  it('respondToQuestion returns applied duplicate after the resumed run suspends again', async () => {
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

    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-Q',
      suspendPayload: {
        toolCallId: 'tc-Q2',
        toolName: 'ask_user',
        args: { question: 'pick again' },
      },
    });
    const first = await session.respondToQuestion({ itemId: 'question:tc-Q', responseId: 'answer-1', answer: 'red' });
    const duplicate = await session.respondToQuestion({
      itemId: 'question:tc-Q',
      responseId: 'answer-1',
      answer: 'red',
    });

    expect(first).toMatchObject({ status: 'applied', duplicate: false, responseId: 'answer-1' });
    expect(duplicate).toMatchObject({ status: 'applied', duplicate: true, responseId: 'answer-1' });
    expect(session.getRecord().pendingResume).toMatchObject({ itemId: 'question:tc-Q2' });
    expect(agent.resumeCalls).toHaveLength(1);
  });

  it('respondToQuestion marks accepted receipts failed when resumeStream throws', async () => {
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

    await expect(
      session.respondToQuestion({ itemId: 'question:tc-Q', responseId: 'answer-1', answer: 'red' }),
    ).rejects.toThrow('FakeAgent: no run enqueued for resumeStream()');

    expect(session.getRecord().inboxResponseReceipts?.['answer-1']).toMatchObject({
      itemId: 'question:tc-Q',
      status: 'failed',
      retryable: false,
      error: expect.objectContaining({ message: 'FakeAgent: no run enqueued for resumeStream()' }),
    });
    await expect(
      session.respondToQuestion({ itemId: 'question:tc-Q', responseId: 'answer-1', answer: 'red' }),
    ).rejects.toThrow('FakeAgent: no run enqueued for resumeStream()');
    expect(agent.resumeCalls).toHaveLength(1);
  });

  it('clears a stale non-queued pending response without replaying resumeStream', async () => {
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
    const pending = session.getRecord().pendingResume!;
    const staleAt = Date.now() - 60_000;
    const response = { answer: 'red' };
    const responseHash = (session as any)._computeInboxResponseHash({
      kind: 'question',
      itemId: pending.itemId,
      runId: pending.runId,
      pendingRequestedAt: pending.requestedAt,
      response,
    });
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingResume: { ...prev.pendingResume, resumedAt: staleAt },
      inboxResponseReceipts: {
        stale: {
          responseId: 'stale',
          responseHash,
          resumeAttemptId: 'stale',
          itemId: pending.itemId,
          kind: 'question',
          runId: pending.runId,
          toolCallId: pending.toolCallId,
          pendingRequestedAt: pending.requestedAt,
          response,
          status: 'accepted',
          acceptedAt: staleAt,
          updatedAt: staleAt,
        },
      },
    }));

    await expect(
      session.respondToQuestion({ itemId: pending.itemId, responseId: 'stale', answer: 'red' }),
    ).rejects.toThrow('queued turn resume was marked in flight');

    expect(session.getRecord().pendingResume).toBeUndefined();
    expect(session.getRecord().inboxResponseReceipts?.stale).toMatchObject({ status: 'failed' });

    agent.enqueueRun({ finishReason: 'stop', text: 'fresh answer' });
    await expect(
      session.respondToQuestion({ itemId: pending.itemId, responseId: 'fresh', answer: 'red' }),
    ).rejects.toThrow('no pending resume on this session');

    expect(agent.resumeCalls).toHaveLength(0);
  });

  it('clears a stale non-queued pending response on a fresh responseId retry', async () => {
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
    const pending = session.getRecord().pendingResume!;
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingResume: { ...prev.pendingResume, resumedAt: Date.now() - 60_000 },
    }));

    await expect(
      session.respondToQuestion({ itemId: pending.itemId, responseId: 'fresh', answer: 'red' }),
    ).rejects.toThrow('queued turn resume was marked in flight');

    expect(session.getRecord().pendingResume).toBeUndefined();
    expect(session.getRecord().inboxResponseReceipts?.fresh).toBeUndefined();
    expect(agent.resumeCalls).toHaveLength(0);
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
