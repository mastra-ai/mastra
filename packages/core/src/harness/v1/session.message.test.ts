/**
 * Harness v1 — Session.message() variants.
 *
 * Covers the three return shapes (default, streaming, structured + sync) plus
 * the per-turn override surface (mode, additionalTools, abortSignal). The
 * tests record the call shape received by a fake agent so we can assert what
 * the session forwarded without standing up a real model.
 */

import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Agent } from '../../agent';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import { HarnessStorageAdmissionConflictError } from '../../storage/domains/harness';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';

import { buildFakeOutput, extractSignalContents } from './__test-utils__/fake-output';
import { MockAgent } from './__test-utils__/mock-agent';
import { setupHarness } from './__test-utils__/setup';
import {
  HarnessAbortedError,
  HarnessAdmissionConflictError,
  HarnessBusyError,
  HarnessConfigError,
  HarnessOutputGenerationError,
  HarnessValidationError,
} from './errors';
import { Harness } from './harness';
import type { MessageOptionsDefault } from './types';

// ---------------------------------------------------------------------------
// Fake agent: skips the model layer entirely. Records what message() passed
// in so the test can assert the call shape.
// ---------------------------------------------------------------------------

interface FakeCall {
  type: 'stream' | 'generate';
  messages: unknown;
  options: any;
}

function nextTick() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

class FakeAgent extends Agent<any, any, any> {
  calls: FakeCall[] = [];
  fullOutput: any = {
    text: 'hello back',
    usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
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
    response: { id: 'r', timestamp: new Date(), modelId: 'fake', messages: [], uiMessages: [] },
    totalUsage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    error: undefined,
    tripwire: undefined,
    traceId: undefined,
    spanId: undefined,
    runId: 'fake-run',
    suspendPayload: undefined,
    messages: [],
    rememberedMessages: [],
  };

  constructor(name: string) {
    super({
      id: name,
      name,
      instructions: 'fake',
      model: 'openai/gpt-4o-mini' as any,
    });
  }

  async stream(messages: any, options?: any): Promise<any> {
    this.calls.push({ type: 'stream', messages, options });
    const out = buildFakeOutput({
      runId: options?.runId ?? this.fullOutput.runId,
      fullOutput: this.fullOutput,
    });
    this._internalRegisterStreamRun(out, (options ?? {}) as any);
    return out;
  }

  async generate(messages: any, options?: any): Promise<any> {
    this.calls.push({ type: 'generate', messages, options });
    return this.fullOutput;
  }
}

class LiveStreamFakeAgent extends FakeAgent {
  releaseStream?: () => void;

  override async stream(messages: any, options?: any): Promise<any> {
    this.calls.push({ type: 'stream', messages, options });
    const runId = options?.runId ?? this.fullOutput.runId;
    const fullOutput = { ...this.fullOutput, runId };
    let releaseStream!: () => void;
    let finishStream!: () => void;
    const release = new Promise<void>(resolve => {
      releaseStream = resolve;
    });
    const finished = new Promise<void>(resolve => {
      finishStream = resolve;
    });
    const fullStream = (async function* () {
      try {
        await release;
      } finally {
        finishStream();
      }
    })();
    const out = {
      runId,
      getFullOutput: async () => fullOutput,
      fullStream,
      text: Promise.resolve(fullOutput.text),
      finishReason: Promise.resolve(fullOutput.finishReason),
      usage: Promise.resolve(fullOutput.usage),
      _waitUntilFinished: () => finished,
    };
    this.releaseStream = releaseStream;
    this._internalRegisterStreamRun(out as any, (options ?? {}) as any);
    return out;
  }
}

class SlowStreamStartFakeAgent extends FakeAgent {
  releaseStreamStart?: () => void;

  override async stream(messages: any, options?: any): Promise<any> {
    this.calls.push({ type: 'stream', messages, options });
    await new Promise<void>(resolve => {
      this.releaseStreamStart = resolve;
    });
    const out = buildFakeOutput({
      runId: options?.runId ?? this.fullOutput.runId,
      fullOutput: this.fullOutput,
    });
    this._internalRegisterStreamRun(out, (options ?? {}) as any);
    return out;
  }
}

function setup(modes?: any) {
  const agent = new FakeAgent('default');
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { default: agent } as any,
    modes: modes ?? [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: { storage },
  });
  return { harness, agent, storage };
}

function setupTwoModes() {
  const defaultAgent = new FakeAgent('default');
  const otherAgent = new FakeAgent('other');
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { default: defaultAgent, other: otherAgent } as any,
    modes: [
      { id: 'default', agentId: 'default' },
      { id: 'other', agentId: 'other' },
    ],
    defaultModeId: 'default',
    sessions: { storage },
  });
  return { harness, defaultAgent, otherAgent, storage };
}

function legacyMessageAdmissionHash(opts: {
  content: unknown;
  modeId: string;
  modelId: string;
  attachments?: Array<{
    attachmentId: string;
    resourceId: string;
    ownerSessionId?: string;
    bytes?: number;
    sha256?: string;
    source?: unknown;
  }>;
}) {
  return createHash('sha256')
    .update(
      canonicalJsonForTest({
        kind: 'signal',
        content: opts.content,
        mode: opts.modeId,
        model: opts.modelId,
        attachments: opts.attachments ?? [],
      }),
      'utf8',
    )
    .digest('hex');
}

function canonicalJsonForTest(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJsonForTest).join(',')}]`;
  return `{${Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJsonForTest(entry)}`)
    .join(',')}}`;
}

async function settleWithinTicks<T>(
  promise: Promise<T>,
  ticks = 10,
): Promise<{ settled: true; value: T } | { settled: false }> {
  return Promise.race([
    promise.then(value => ({ settled: true as const, value })),
    (async () => {
      for (let i = 0; i < ticks; i += 1) {
        await nextTick();
      }
      return { settled: false as const };
    })(),
  ]);
}

describe('Session.message() — default path', () => {
  it('returns a fully-resolved AgentResult bundle', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const result = await session.message({ content: 'hi' });

    expect(result.text).toBe('hello back');
    expect(result.finishReason).toBe('stop');
    expect(result.usage).toEqual({ inputTokens: 1, outputTokens: 2, totalTokens: 3 });

    // Under signal-routed message(), agent.stream() receives a
    // CreatedAgentSignal whose contents is the caller-supplied prompt.
    expect(agent.calls).toHaveLength(1);
    expect(agent.calls[0]!.type).toBe('stream');
    expect((agent.calls[0]!.messages as { type: string; contents: unknown }).type).toBe('user');
    expect(extractSignalContents(agent.calls[0]!.messages)).toBe('hi');
  });

  it('threads memory.thread + memory.resource through to the agent', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'r-mem', threadId: { fresh: true } });

    await session.message({ content: 'hi' });
    expect(agent.calls[0]!.options.memory).toEqual({
      thread: session.threadId,
      resource: 'r-mem',
    });
  });

  it('mints a per-turn signal for caller-supplied abortSignal', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const ac = new AbortController();
    await session.message({ content: 'hi', abortSignal: ac.signal });
    // Session mints its own per-turn AbortController so `session.abort()` can also cancel the run.
    const turnSignal = agent.calls[0]!.options.abortSignal as AbortSignal;
    expect(turnSignal).toBeInstanceOf(AbortSignal);
    expect(turnSignal).not.toBe(ac.signal);
    expect(turnSignal.aborted).toBe(false);
  });

  it('forwards a live caller abort into the per-turn signal', async () => {
    const agent = new LiveStreamFakeAgent('default');
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const ac = new AbortController();
    const pending = session.message({ content: 'hi', abortSignal: ac.signal, stream: true });
    await vi.waitFor(() => expect(agent.calls).toHaveLength(1));

    const turnSignal = agent.calls[0]!.options.abortSignal as AbortSignal;
    expect(turnSignal.aborted).toBe(false);
    ac.abort('caller-cancelled');
    expect(turnSignal.aborted).toBe(true);
    // §6.2: an external raw-string caller abort is normalized to a typed
    // HarnessAbortedError('agent_aborted') — the caller string is not a structured reason.
    expect((turnSignal as { reason?: unknown }).reason).toBeInstanceOf(HarnessAbortedError);
    expect((turnSignal as { reason?: HarnessAbortedError }).reason).toMatchObject({ reason: 'agent_aborted' });

    agent.releaseStream?.();
    await pending.catch(() => undefined);
  });

  it('maps a parent run abort propagated via the caller signal to child-local parent_aborted (§6.2)', async () => {
    const agent = new LiveStreamFakeAgent('default');
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage },
    });
    const parent = await harness.session({ resourceId: 'u-shared', threadId: { fresh: true } });
    // A subagent shares the parent's resource; built-in subagents are started with
    // the parent tool's abort signal (spawn-subagent-tool), modelled here directly.
    const child = await harness.session({
      resourceId: 'u-shared',
      threadId: { fresh: true },
      parentSessionId: parent.id,
    });
    const parentTurn = new AbortController();
    const pending = child.message({ content: 'child work', abortSignal: parentTurn.signal, stream: true });
    await vi.waitFor(() => expect(agent.calls).toHaveLength(1));

    const childTurnSignal = agent.calls[0]!.options.abortSignal as AbortSignal;
    // The parent run aborts with its own typed HarnessAbortedError; the child must
    // re-label it as parent_aborted carrying the parent session id.
    parentTurn.abort(new HarnessAbortedError(parent.id, 'agent_aborted'));
    expect(childTurnSignal.aborted).toBe(true);
    expect((childTurnSignal as { reason?: unknown }).reason).toBeInstanceOf(HarnessAbortedError);
    expect((childTurnSignal as { reason?: HarnessAbortedError }).reason).toMatchObject({
      reason: 'parent_aborted',
      sessionId: child.id,
      parentSessionId: parent.id,
    });

    agent.releaseStream?.();
    await pending.catch(() => undefined);
  });

  it('does not let the caller signal abort the per-turn signal after the turn completes', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const ac = new AbortController();
    await session.message({ content: 'hi', abortSignal: ac.signal });
    const turnSignal = agent.calls[0]!.options.abortSignal as AbortSignal;
    ac.abort('caller-cancelled');
    expect(turnSignal.aborted).toBe(false);
  });

  it('deduplicates an exact admissionId retry without accepting a second signal', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const first = await session.message({ content: 'hi', admissionId: 'admission-1' });
    const second = await session.message({ content: 'hi', admissionId: 'admission-1' });

    expect(first.text).toBe('hello back');
    expect(second.text).toBe('hello back');
    expect(agent.calls).toHaveLength(1);
  });

  it('binds logical identity to the admitted message hash', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.message({
      content: 'hi',
      admissionId: 'lineage-admission',
      logicalMessageIdentity: { input: 'input-1', response: 'response-1' },
    });

    await expect(
      session.message({
        content: 'hi',
        admissionId: 'lineage-admission',
        logicalMessageIdentity: { input: 'input-2', response: 'response-2' },
      }),
    ).rejects.toBeInstanceOf(HarnessAdmissionConflictError);
    expect(agent.calls).toHaveLength(1);
  });

  it('aborts an unresolved native logical-message dispatch without failing its admission', async () => {
    const agent = new MockAgent({ id: 'default' });
    let releaseRun!: () => void;
    let nativeAbortObserved!: () => void;
    const nativeAbort = new Promise<void>(resolve => {
      nativeAbortObserved = resolve;
    });
    agent.enqueueRun({
      holdUntil: new Promise<void>(resolve => {
        releaseRun = resolve;
      }),
      onAbort: () => nativeAbortObserved(),
    });
    const { harness } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const realSendSignal = agent.sendSignal.bind(agent);
    let nativeAbortSignal: AbortSignal | undefined;
    agent.sendSignal = ((signal: any, target: any) => {
      nativeAbortSignal = target.ifIdle?.streamOptions?.abortSignal;
      const dispatched = realSendSignal(signal, target);
      return { ...dispatched, accepted: new Promise<never>(() => {}) };
    }) as typeof agent.sendSignal;

    vi.useFakeTimers();
    try {
      const pending = session.message({
        content: 'wait for native acceptance',
        admissionId: 'message-native-timeout',
        logicalMessageIdentity: { input: 'timeout-input', response: 'timeout-response' },
      });
      const rejection = expect(pending).rejects.toMatchObject({ name: 'HarnessValidationError' });
      await vi.advanceTimersByTimeAsync(30_001);
      await rejection;
    } finally {
      vi.useRealTimers();
    }

    expect(nativeAbortSignal?.aborted).toBe(true);
    await expect(nativeAbort).resolves.toBeUndefined();
    const identity = (session as any)._messageAdmissionIdentity('message-native-timeout') as { signalId: string };
    await expect(session.lookupMessageResult(identity.signalId)).resolves.toMatchObject({ status: 'pending' });
    expect(session.isRunning()).toBe(false);
    releaseRun();
  });

  it('keeps an omitted logical identity out of direct dispatch after caller mutation', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const sendSignal = vi.spyOn(agent, 'sendSignal');
    const realBuildRequestContext = (session as any)._buildRequestContext.bind(session);
    let releaseContext!: () => void;
    let contextStarted!: () => void;
    const contextStartedPromise = new Promise<void>(resolve => {
      contextStarted = resolve;
    });
    const contextGate = new Promise<void>(resolve => {
      releaseContext = resolve;
    });
    (session as any)._buildRequestContext = async (...args: any[]) => {
      contextStarted();
      await contextGate;
      return realBuildRequestContext(...args);
    };

    const options: MessageOptionsDefault = {
      content: 'ordinary message',
      admissionId: 'message-omitted-identity',
    };
    const pending = session.message(options);
    await contextStartedPromise;
    options.logicalMessageIdentity = { input: 'late-input', response: 'late-response' };
    releaseContext();

    await pending;
    expect(agent.calls[0]?.options.logicalMessageIdentity).toBeUndefined();
    expect(sendSignal.mock.calls[0]?.[0]).not.toHaveProperty('metadata');
  });

  it('rejects a full logical message when a run becomes active during reservation', async () => {
    const agent = new MockAgent({ id: 'default' });
    let releaseActive!: () => void;
    agent.enqueueRun({
      holdUntil: new Promise<void>(resolve => {
        releaseActive = resolve;
      }),
      text: 'active terminal',
    });
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const realWrite = storage.writeMessageResultEvidence.bind(storage);
    let reservationStarted!: () => void;
    const reservationObserved = new Promise<void>(resolve => {
      reservationStarted = resolve;
    });
    let releaseReservation!: () => void;
    const reservationGate = new Promise<void>(resolve => {
      releaseReservation = resolve;
    });
    storage.writeMessageResultEvidence = async record => {
      if (record.admissionId === 'lineage-message-active-race' && record.status === 'pending') {
        reservationStarted();
        await reservationGate;
      }
      return realWrite(record);
    };

    const pending = session.message({
      content: 'wake with a response owner',
      admissionId: 'lineage-message-active-race',
      logicalMessageIdentity: { input: 'input-race', response: 'response-race' },
    });
    await reservationObserved;

    const nativeSubscription = await agent.subscribeToThread({
      resourceId: session.resourceId,
      threadId: session.threadId,
    });
    const active = session.message({ content: 'active work' });
    await vi.waitFor(() => expect(agent.streamCalls).toHaveLength(1));
    await vi.waitFor(() => expect(nativeSubscription.activeRunId()).not.toBeNull());
    releaseReservation();

    await expect(pending).rejects.toBeInstanceOf(HarnessConfigError);
    const identity = (session as any)._messageAdmissionIdentity('lineage-message-active-race') as { signalId: string };
    await expect(session.lookupMessageResult(identity.signalId)).resolves.toMatchObject({ status: 'failed' });

    releaseActive();
    await active;
    await expect(
      session.message({
        content: 'wake with a response owner',
        admissionId: 'lineage-message-active-race',
        logicalMessageIdentity: { input: 'input-race', response: 'response-race' },
      }),
    ).rejects.toMatchObject({ name: 'HarnessExecutionError' });
    expect(agent.streamCalls).toHaveLength(1);
  });

  it('replays a completed admitted message after a cold Harness and storage restart', async () => {
    const db = new InMemoryDB();
    const storage1 = new InMemoryHarness({ db });
    const agent1 = new FakeAgent('default');
    const harness1 = new Harness({
      agents: { default: agent1 } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage: storage1 },
    });
    const session1 = await harness1.session({ resourceId: 'u1', threadId: { fresh: true } });
    const sessionId = session1.id;
    await expect(session1.message({ content: 'hi', admissionId: 'restart-completed' })).resolves.toMatchObject({
      text: 'hello back',
    });
    await harness1.shutdown();

    const storage2 = new InMemoryHarness({ db });
    const agent2 = new FakeAgent('default');
    const harness2 = new Harness({
      agents: { default: agent2 } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage: storage2 },
    });
    try {
      const session2 = await harness2.session({ sessionId, resourceId: 'u1' });
      await expect(session2.message({ content: 'hi', admissionId: 'restart-completed' })).resolves.toMatchObject({
        text: 'hello back',
      });
      expect(agent2.calls).toHaveLength(0);
    } finally {
      await harness2.shutdown();
    }
  });

  it('replays a failed admitted message after a cold Harness and storage restart', async () => {
    const db = new InMemoryDB();
    const storage1 = new InMemoryHarness({ db });
    const agent1 = new FakeAgent('default');
    vi.spyOn(agent1, 'stream').mockRejectedValue(new Error('model failed'));
    const harness1 = new Harness({
      agents: { default: agent1 } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage: storage1 },
    });
    const session1 = await harness1.session({ resourceId: 'u1', threadId: { fresh: true } });
    const sessionId = session1.id;
    await expect(session1.message({ content: 'hi', admissionId: 'restart-failed' })).rejects.toBeDefined();
    await harness1.shutdown();

    const storage2 = new InMemoryHarness({ db });
    const agent2 = new FakeAgent('default');
    const harness2 = new Harness({
      agents: { default: agent2 } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage: storage2 },
    });
    try {
      const session2 = await harness2.session({ sessionId, resourceId: 'u1' });
      await expect(session2.message({ content: 'hi', admissionId: 'restart-failed' })).rejects.toBeDefined();
      expect(agent2.calls).toHaveLength(0);
    } finally {
      await harness2.shutdown();
    }
  });

  it('admits a message and returns signal identity before result lookup', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const admitted = await session.admitMessage({ content: 'hi', admissionId: 'admit-1' });
    const duplicate = await session.admitMessage({ content: 'hi', admissionId: 'admit-1' });

    expect(admitted).toMatchObject({ accepted: true, duplicate: false, signalId: expect.any(String) });
    expect(duplicate).toMatchObject({
      accepted: true,
      duplicate: true,
      signalId: admitted.signalId,
      runId: admitted.runId,
    });
    expect(agent.calls).toHaveLength(1);
  });

  it('freezes the normalized logical identity before admitMessage awaits or dispatches', async () => {
    const { harness, agent, storage } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const identity = {
      input: 'admit-input',
      response: 'admit-response',
      extra: 'ignored by the native identity contract',
    } as any;
    let releaseLookup!: () => void;
    let lookupStarted!: () => void;
    const lookupStartedPromise = new Promise<void>(resolve => {
      lookupStarted = resolve;
    });
    const lookupGate = new Promise<void>(resolve => {
      releaseLookup = resolve;
    });
    const realResolve = storage.resolveOperationAdmissionEvidence.bind(storage);
    let gated = false;
    storage.resolveOperationAdmissionEvidence = async options => {
      if (!gated && options.admissionId === 'admit-normalized-identity') {
        gated = true;
        lookupStarted();
        await lookupGate;
      }
      return realResolve(options);
    };

    const pending = session.admitMessage({
      content: 'freeze this identity',
      admissionId: 'admit-normalized-identity',
      logicalMessageIdentity: identity,
    });
    await lookupStartedPromise;
    identity.response = 'mutated-after-admission-start';
    releaseLookup();

    await expect(pending).resolves.toMatchObject({ accepted: true, duplicate: false });
    expect(agent.calls[0]?.options.logicalMessageIdentity).toEqual({
      input: 'admit-input',
      response: 'admit-response',
    });
  });

  it('keeps an omitted logical identity out of admitMessage dispatch after caller mutation', async () => {
    const { harness, agent, storage } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    let releaseLookup!: () => void;
    let lookupStarted!: () => void;
    const lookupStartedPromise = new Promise<void>(resolve => {
      lookupStarted = resolve;
    });
    const lookupGate = new Promise<void>(resolve => {
      releaseLookup = resolve;
    });
    const realResolve = storage.resolveOperationAdmissionEvidence.bind(storage);
    let gated = false;
    storage.resolveOperationAdmissionEvidence = async options => {
      if (!gated && options.admissionId === 'admit-omitted-identity') {
        gated = true;
        lookupStarted();
        await lookupGate;
      }
      return realResolve(options);
    };

    const options: MessageOptionsDefault = {
      content: 'ordinary admitted message',
      admissionId: 'admit-omitted-identity',
    };
    const pending = session.admitMessage(options);
    await lookupStartedPromise;
    options.logicalMessageIdentity = { input: 'late-input', response: 'late-response' };
    releaseLookup();

    await expect(pending).resolves.toMatchObject({ accepted: true, duplicate: false });
    expect(agent.calls[0]?.options.logicalMessageIdentity).toBeUndefined();
  });

  it('returns message admission before a slow stream output is available', async () => {
    const agent = new SlowStreamStartFakeAgent('default');
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const admittedPromise = session.admitMessage({ content: 'hi', admissionId: 'admit-slow-start' });
    const admitted = await settleWithinTicks(admittedPromise);

    expect(admitted).toMatchObject({
      settled: true,
      value: { accepted: true, duplicate: false, signalId: expect.any(String) },
    });
    expect(agent.calls).toHaveLength(1);
    agent.releaseStreamStart?.();
  });

  it('reports an in-flight message admission piggyback as a duplicate', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const admissionId = 'admit-live-duplicate';
    const admissionHash = (session as any)._computeMessageAdmissionHashes(
      { content: 'hi', admissionId },
      { modeId: 'default', modelId: 'default' },
    ).primary;

    (session as any)._messageAdmissionStarts.set(admissionId, {
      admissionHash,
      modeId: 'default',
      promise: Promise.resolve({
        status: 'pending',
        harnessName: 'default',
        sessionId: session.id,
        resourceId: session.resourceId,
        threadId: session.threadId,
        signalId: 'sig-live',
        runId: 'run-live',
        admissionId,
        admissionHash,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    });

    const admitted = await session.admitMessage({ content: 'hi', admissionId });

    expect(admitted).toEqual({ accepted: true, duplicate: true, signalId: 'sig-live', runId: 'run-live' });
    expect(agent.calls).toHaveLength(0);
  });

  it('treats primitive and file attachment refs as different admission identities', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.message({
      content: 'render this',
      admissionId: 'attachment-kind-conflict',
      attachments: [
        {
          attachmentId: 'att-1',
          resourceId: 'u1',
          kind: 'primitive',
          primitiveType: 'markdown',
          schemaId: 'schema-v1',
        },
      ],
    });

    await expect(
      session.message({
        content: 'render this',
        admissionId: 'attachment-kind-conflict',
        attachments: [{ attachmentId: 'att-1', resourceId: 'u1', kind: 'file' }],
      }),
    ).rejects.toBeInstanceOf(HarnessAdmissionConflictError);
  });

  it('replays legacy duplicate admissions hashed before attachment metadata fields existed', async () => {
    const { harness, agent, storage } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const legacyAdmissionHash = legacyMessageAdmissionHash({
      content: 'render this',
      modeId: 'default',
      modelId: (session as any)._record.modelId,
      attachments: [
        {
          attachmentId: 'att-legacy',
          resourceId: 'u1',
          bytes: 42,
          sha256: 'abc123',
        },
      ],
    });

    await storage.writeMessageResultEvidence({
      harnessName: (session as any)._record.harnessName,
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      status: 'completed',
      signalId: 'legacy-attachment-signal',
      runId: 'legacy-attachment-run',
      result: agent.fullOutput,
      admissionId: 'legacy-attachment-admission',
      admissionHash: legacyAdmissionHash,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const duplicate = await session.message({
      content: 'render this',
      admissionId: 'legacy-attachment-admission',
      attachments: [
        {
          attachmentId: 'att-legacy',
          resourceId: 'u1',
          bytes: 42,
          sha256: 'abc123',
          kind: 'primitive',
          primitiveType: 'markdown',
          schemaId: 'schema-v1',
          metadata: { display: 'inline' },
        },
      ],
    });

    expect(duplicate.text).toBe('hello back');
    expect(agent.calls).toHaveLength(0);
  });

  it('admits duplicate messages from durable evidence when the retry races past the first lookup', async () => {
    const { harness, agent, storage } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const first = await session.message({ content: 'hi', admissionId: 'admit-race-completed' });
    const resolveOperationAdmissionEvidence = storage.resolveOperationAdmissionEvidence.bind(storage);
    let skippedFirstLookup = false;
    storage.resolveOperationAdmissionEvidence = async opts => {
      if (!skippedFirstLookup && opts.kind === 'signal' && opts.admissionId === 'admit-race-completed') {
        skippedFirstLookup = true;
        return { status: 'none' };
      }
      return resolveOperationAdmissionEvidence(opts);
    };

    const admitted = await session.admitMessage({ content: 'hi', admissionId: 'admit-race-completed' });

    expect(admitted).toMatchObject({
      accepted: true,
      duplicate: true,
      signalId: expect.any(String),
      runId: expect.any(String),
    });
    expect(first.text).toBe('hello back');
    expect(agent.calls).toHaveLength(1);
  });

  it('does not treat a later default mode switch as a conflicting duplicate admission', async () => {
    const { harness, defaultAgent, otherAgent } = setupTwoModes();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const first = await session.message({ content: 'hi', admissionId: 'admission-mode-default' });
    await session.switchMode({ mode: 'other' });
    const second = await session.message({ content: 'hi', admissionId: 'admission-mode-default' });

    expect(first.text).toBe('hello back');
    expect(second.text).toBe('hello back');
    expect(defaultAgent.calls).toHaveLength(1);
    expect(otherAgent.calls).toHaveLength(0);
  });

  it('returns a live stream duplicate from the original mode after a default mode switch', async () => {
    const defaultAgent = new LiveStreamFakeAgent('default');
    const otherAgent = new FakeAgent('other');
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const harness = new Harness({
      agents: { default: defaultAgent, other: otherAgent } as any,
      modes: [
        { id: 'default', agentId: 'default' },
        { id: 'other', agentId: 'other' },
      ],
      defaultModeId: 'default',
      sessions: { storage },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const first = await session.message({ content: 'hi', admissionId: 'admission-live-stream', stream: true });
    await session.switchMode({ mode: 'other' });
    const duplicate = await session.message({ content: 'hi', admissionId: 'admission-live-stream', stream: true });

    expect(duplicate).toBe(first);
    expect(defaultAgent.calls).toHaveLength(1);
    expect(otherAgent.calls).toHaveLength(0);

    defaultAgent.releaseStream?.();
    await session.waitForIdle({ timeoutMs: 1_000 });
  });

  it('treats an explicit default mode as distinct from an omitted default mode for admission hashing', async () => {
    const { harness, defaultAgent } = setupTwoModes();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.message({ content: 'hi', admissionId: 'admission-explicit-mode' });
    await expect(
      session.message({ content: 'hi', mode: 'default', admissionId: 'admission-explicit-mode' }),
    ).rejects.toBeInstanceOf(HarnessAdmissionConflictError);
    expect(defaultAgent.calls).toHaveLength(1);
  });

  it('does not treat a later default model switch as a conflicting duplicate admission', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const first = await session.message({ content: 'hi', admissionId: 'admission-model-default' });
    await session.models.switch({ model: 'gpt-5' });
    const second = await session.message({ content: 'hi', admissionId: 'admission-model-default' });

    expect(first.text).toBe('hello back');
    expect(second.text).toBe('hello back');
    expect(agent.calls).toHaveLength(1);
  });

  it('treats an explicit selected model as distinct from an omitted selected model for admission hashing', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.models.switch({ model: 'gpt-5' });
    await session.message({ content: 'hi', admissionId: 'admission-explicit-model' });
    await expect(
      session.message({ content: 'hi', model: 'gpt-5', admissionId: 'admission-explicit-model' }),
    ).rejects.toBeInstanceOf(HarnessAdmissionConflictError);
    expect(agent.calls).toHaveLength(1);
  });

  it('treats different modelSettings as distinct admission identities', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.message({
      content: 'hi',
      admissionId: 'admission-model-settings',
      modelSettings: { temperature: 0.2 },
    });
    await expect(
      session.message({
        content: 'hi',
        admissionId: 'admission-model-settings',
        modelSettings: { temperature: 0.8 },
      }),
    ).rejects.toBeInstanceOf(HarnessAdmissionConflictError);
    expect(agent.calls).toHaveLength(1);
  });

  it('rejects legacy effective mode/model evidence after mode drift unless the original mode is explicit', async () => {
    const { harness, defaultAgent, otherAgent, storage } = setupTwoModes();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const legacyAdmissionHash = legacyMessageAdmissionHash({
      content: 'hi',
      modeId: 'default',
      modelId: (session as any)._record.modelId,
    });

    await storage.writeMessageResultEvidence({
      harnessName: (session as any)._record.harnessName,
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      status: 'completed',
      signalId: 'legacy-signal',
      runId: 'legacy-run',
      result: defaultAgent.fullOutput,
      admissionId: 'legacy-admission',
      admissionHash: legacyAdmissionHash,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await session.switchMode({ mode: 'other' });
    await expect(session.message({ content: 'hi', admissionId: 'legacy-admission' })).rejects.toBeInstanceOf(
      HarnessAdmissionConflictError,
    );

    expect(defaultAgent.calls).toHaveLength(0);
    expect(otherAgent.calls).toHaveLength(0);
  });

  it('replays legacy duplicate admissions when the caller supplies the original effective mode', async () => {
    const { harness, defaultAgent, otherAgent, storage } = setupTwoModes();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const legacyAdmissionHash = legacyMessageAdmissionHash({
      content: 'hi',
      modeId: 'default',
      modelId: (session as any)._record.modelId,
    });

    await storage.writeMessageResultEvidence({
      harnessName: (session as any)._record.harnessName,
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      status: 'completed',
      signalId: 'legacy-signal',
      runId: 'legacy-run',
      result: defaultAgent.fullOutput,
      admissionId: 'legacy-explicit-admission',
      admissionHash: legacyAdmissionHash,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await session.switchMode({ mode: 'other' });
    const duplicate = await session.message({
      content: 'hi',
      mode: 'default',
      admissionId: 'legacy-explicit-admission',
    });

    expect(duplicate.text).toBe('hello back');
    expect(defaultAgent.calls).toHaveLength(0);
    expect(otherAgent.calls).toHaveLength(0);
  });

  it('replays exact duplicate admissions that race with the reservation write', async () => {
    const { harness, agent, storage } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const writeMessageResultEvidence = storage.writeMessageResultEvidence.bind(storage);
    const resolveOperationAdmissionEvidence = storage.resolveOperationAdmissionEvidence.bind(storage);
    let raced = false;
    storage.writeMessageResultEvidence = async record => {
      if (!raced && record.status === 'pending' && record.admissionId === 'exact-race') {
        raced = true;
        await writeMessageResultEvidence({
          ...record,
          status: 'completed',
          result: agent.fullOutput,
        });
      }
      return writeMessageResultEvidence(record);
    };
    storage.resolveOperationAdmissionEvidence = async opts => {
      if (raced && opts.kind === 'signal' && opts.admissionId === 'exact-race') {
        return { status: 'none' };
      }
      return resolveOperationAdmissionEvidence(opts);
    };

    const duplicate = await session.message({ content: 'hi', admissionId: 'exact-race' });

    expect(duplicate.text).toBe('hello back');
    expect(agent.calls).toHaveLength(0);
  });

  it('replays legacy duplicate admissions that race with the reservation write', async () => {
    const { harness, defaultAgent, otherAgent, storage } = setupTwoModes();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const writeMessageResultEvidence = storage.writeMessageResultEvidence.bind(storage);
    let raced = false;
    storage.writeMessageResultEvidence = async record => {
      if (!raced && record.status === 'pending' && record.admissionId === 'legacy-race') {
        raced = true;
        const legacyAdmissionHash = legacyMessageAdmissionHash({
          content: 'hi',
          modeId: 'default',
          modelId: (session as any)._record.modelId,
        });
        await writeMessageResultEvidence({
          ...record,
          status: 'completed',
          signalId: 'legacy-race-signal',
          runId: 'legacy-race-run',
          result: defaultAgent.fullOutput,
          admissionHash: legacyAdmissionHash,
        });
        throw new HarnessStorageAdmissionConflictError(record.sessionId, 'message', record.admissionId);
      }
      return writeMessageResultEvidence(record);
    };

    const duplicate = await session.message({ content: 'hi', admissionId: 'legacy-race' });

    expect(duplicate.text).toBe('hello back');
    expect(defaultAgent.calls).toHaveLength(0);
    expect(otherAgent.calls).toHaveLength(0);
  });

  it('does not convert completed admission evidence write failures into failed evidence', async () => {
    class CompletedEvidenceFailingStorage extends InMemoryHarness {
      readonly writes: string[] = [];

      override async writeMessageResultEvidence(record: any): Promise<{ created: boolean; applied: boolean }> {
        this.writes.push(record.status);
        if (record.status === 'completed') throw new Error('completed evidence unavailable');
        return super.writeMessageResultEvidence(record);
      }
    }
    const agent = new FakeAgent('default');
    const storage = new CompletedEvidenceFailingStorage({ db: new InMemoryDB() });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    // §13.3f.1: `message()` is a public §4.2b boundary, so a raw storage
    // failure is REDACTED on the in-process rejection — `.message` is the
    // generic `harness.internal` text and the raw original is preserved
    // local-only on `.cause`. (The behavior under test is that a *completed*
    // evidence write failure is NOT converted into `failed` evidence; see the
    // `storage.writes` assertions below.)
    const thrown = await session.message({ content: 'hi', admissionId: 'admission-1' }).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect((thrown as Error).name).toBe('HarnessExecutionError');
    expect((thrown as Error).message).toBe('An internal harness error occurred');
    expect(((thrown as { cause?: Error }).cause as Error).message).toBe('completed evidence unavailable');

    expect(storage.writes).toContain('completed');
    expect(storage.writes).not.toContain('failed');
  });

  it('writes streamed admission pending evidence exactly once (pre-dispatch reservation)', async () => {
    class PendingWriteCountingStorage extends InMemoryHarness {
      readonly writes: any[] = [];
      pendingWrites = 0;

      override async writeMessageResultEvidence(record: any): Promise<{ created: boolean; applied: boolean }> {
        this.writes.push(record);
        if (record.admissionId === 'stream-pending-once' && record.status === 'pending') {
          this.pendingWrites++;
        }
        return super.writeMessageResultEvidence(record);
      }
    }
    const agent = new LiveStreamFakeAgent('default');
    const storage = new PendingWriteCountingStorage({ db: new InMemoryDB() });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    try {
      const out = await session.message({ content: 'go', admissionId: 'stream-pending-once', stream: true });
      expect(out).toBeDefined();
      // PF-2250 §1 — the pre-dispatch reservation is the single durable
      // admission barrier. A post-dispatch 'pending' refresh would be a
      // byte-identical row (admission-derived signalId/runId) whose write used
      // to be awaited on the first-token path; it must never come back.
      expect(storage.pendingWrites).toBe(1);
    } finally {
      agent.releaseStream?.();
      await nextTick();
      await nextTick();
    }
    const completedWrite = storage.writes.find(record => record.status === 'completed');
    expect(completedWrite).toMatchObject({ admissionId: 'stream-pending-once', status: 'completed' });
  });

  it('does not wait for failed evidence persistence before rejecting stream admission startup', async () => {
    let releaseFailedWrite!: () => void;
    let resolveFailedWriteStarted!: () => void;
    let resolveFailedWriteFinished!: () => void;
    let failedSignalId!: string;
    const failedWriteStarted = new Promise<void>(resolve => {
      resolveFailedWriteStarted = resolve;
    });
    const failedWriteFinished = new Promise<void>(resolve => {
      resolveFailedWriteFinished = resolve;
    });
    const failedWriteCanFinish = new Promise<void>(resolve => {
      releaseFailedWrite = resolve;
    });
    class StallingFailedEvidenceStorage extends InMemoryHarness {
      override async writeMessageResultEvidence(record: any): Promise<{ created: boolean; applied: boolean }> {
        if (record.admissionId === 'stream-pending-stalled-failure' && record.status === 'failed') {
          failedSignalId = record.signalId;
          resolveFailedWriteStarted();
          await failedWriteCanFinish;
          const result = await super.writeMessageResultEvidence(record);
          resolveFailedWriteFinished();
          return result;
        }
        return super.writeMessageResultEvidence(record);
      }
    }
    // PF-2250 §1 removed the post-dispatch pending refresh, so the reachable
    // post-dispatch failure is the dispatched run's output settling with an
    // error. The invariant under test is unchanged: the caller rejection must
    // not wait for the background 'failed' evidence write.
    class RejectingStreamFakeAgent extends FakeAgent {
      override async stream(messages: any, options?: any): Promise<any> {
        this.calls.push({ type: 'stream', messages, options });
        throw new Error('post-dispatch output unavailable');
      }
    }
    const agent = new RejectingStreamFakeAgent('default');
    const storage = new StallingFailedEvidenceStorage({ db: new InMemoryDB() });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    let outcome: { ok: true } | { ok: false; err: unknown } | undefined;
    const outcomePromise = session
      .message({ content: 'go', admissionId: 'stream-pending-stalled-failure', stream: true })
      .then(() => ({ ok: true as const }))
      .catch(err => ({ ok: false as const, err }));
    void outcomePromise.then(value => {
      outcome = value;
    });

    try {
      await failedWriteStarted;
      await nextTick();

      expect(outcome).toBeDefined();
      expect(outcome!.ok).toBe(false);
      if (!outcome!.ok) {
        // §13.3f.1: the public `message({ stream: true })` rejection is REDACTED —
        // generic `harness.internal` message with the raw original on `.cause`.
        // The point under test is that this rejection lands BEFORE the failed
        // evidence write finishes, which the redaction does not change.
        expect((outcome!.err as Error).name).toBe('HarnessExecutionError');
        expect((outcome!.err as Error).message).toBe('An internal harness error occurred');
        expect(((outcome!.err as { cause?: Error }).cause as Error).message).toBe('post-dispatch output unavailable');
      }
      // The dispatched run's output settled with an error before any live
      // stream existed, so there is nothing to abort — the turn must simply be
      // finished from the caller's perspective while the failed-evidence write
      // is still stalled below.
      expect(session.isRunning()).toBe(false);

      await expect(
        session.message({ content: 'go', admissionId: 'stream-pending-stalled-failure', stream: true }),
      ).rejects.toMatchObject({
        name: 'HarnessValidationError',
        message: expect.stringContaining('duplicate stream is no longer live'),
      });
      expect(agent.calls).toHaveLength(1);

      releaseFailedWrite();
      await failedWriteFinished;
      await expect(
        storage.loadMessageResultEvidence({
          harnessName: (session as any)._record.harnessName,
          sessionId: session.id,
          resourceId: session.resourceId,
          threadId: session.threadId,
          signalId: failedSignalId,
        }),
      ).resolves.toMatchObject({
        admissionId: 'stream-pending-stalled-failure',
        status: 'failed',
      });
      await expect(
        session.message({ content: 'go', admissionId: 'stream-pending-stalled-failure', stream: true }),
      ).rejects.toMatchObject({
        name: 'HarnessValidationError',
        message: expect.stringContaining('duplicate stream is no longer live'),
      });
      expect(agent.calls).toHaveLength(1);
    } finally {
      agent.releaseStream?.();
      if (typeof releaseFailedWrite === 'function') releaseFailedWrite();
      await nextTick();
    }
  });

  it('deduplicates concurrent exact admissionId retries before dispatching a second signal', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const [first, second] = await Promise.all([
      session.message({ content: 'hi', admissionId: 'admission-1' }),
      session.message({ content: 'hi', admissionId: 'admission-1' }),
    ]);

    expect(first.text).toBe('hello back');
    expect(second.text).toBe('hello back');
    expect(agent.calls).toHaveLength(1);
  });

  it('rejects a same admissionId retry with different message inputs before a second signal', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.message({ content: 'hi', admissionId: 'admission-1' });
    await expect(session.message({ content: 'changed', admissionId: 'admission-1' })).rejects.toBeInstanceOf(
      HarnessAdmissionConflictError,
    );
    expect(agent.calls).toHaveLength(1);
  });

  it('rejects concurrent conflicting admissionId retries without dispatching a second signal', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const results = await Promise.allSettled([
      session.message({ content: 'hi', admissionId: 'admission-1' }),
      session.message({ content: 'changed', admissionId: 'admission-1' }),
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected');
    expect(rejected?.reason).toBeInstanceOf(HarnessAdmissionConflictError);
    expect(agent.calls).toHaveLength(1);
  });

  it('rejects admissionId with non-hash-safe additionalTools', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(
      session.message({ content: 'hi', admissionId: 'admission-1', additionalTools: { local: {} as any } }),
    ).rejects.toBeInstanceOf(HarnessValidationError);
  });

  it('rejects an empty admissionId', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.message({ content: 'hi', admissionId: '' })).rejects.toBeInstanceOf(HarnessValidationError);
  });

  it('rejects a stream retry after a completed admissionId result', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.message({ content: 'hi', admissionId: 'admission-1' });

    await expect(session.message({ content: 'hi', admissionId: 'admission-1', stream: true })).rejects.toBeInstanceOf(
      HarnessValidationError,
    );
    expect(agent.calls).toHaveLength(1);
  });

  it('normalizes duplicate stream retries when the pending run output was rejected', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    vi.spyOn(agent, 'getRunOutput').mockReturnValue(undefined);
    vi.spyOn(agent, 'waitForRunOutput').mockRejectedValue(new Error('raw runtime tombstone'));
    (session as any)._completedRuns.set('rejected-run', { ok: false, err: new Error('cached failed run') });

    await expect(
      (session as any)._returnDuplicateMessageResult(
        { status: 'pending', signalId: 'signal-1', runId: 'rejected-run' },
        { stream: true },
      ),
    ).rejects.toMatchObject({
      name: 'HarnessValidationError',
      message: expect.stringContaining('duplicate stream is no longer live'),
    });
  });

  it('returns a duplicate stream retry when the pending run output registers after recovery starts', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const output = buildFakeOutput({
      runId: 'pending-retry-run',
      fullOutput: agent.fullOutput,
    });
    vi.spyOn(agent, 'getRunOutput').mockReturnValue(undefined);
    vi.spyOn(agent, 'waitForRunOutput').mockResolvedValue(output);

    await expect(
      (session as any)._returnDuplicateMessageResult(
        { status: 'pending', signalId: 'signal-1', runId: 'pending-retry-run' },
        { stream: true },
      ),
    ).resolves.toBe(output);
  });

  it('does not wait for duplicate stream retries when the pending run already completed', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const waitForRunOutput = vi.spyOn(agent, 'waitForRunOutput');
    (session as any)._completedRuns.set('completed-pending-run', { ok: true, full: agent.fullOutput });

    await expect(
      (session as any)._returnDuplicateMessageResult(
        { status: 'pending', signalId: 'signal-1', runId: 'completed-pending-run' },
        { stream: true },
      ),
    ).rejects.toMatchObject({
      name: 'HarnessValidationError',
      message: expect.stringContaining('duplicate stream is no longer live'),
    });
    expect(waitForRunOutput).not.toHaveBeenCalled();
  });

  it('keeps the original startup failure when a later run watcher failure arrives', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const startupError = new Error('post-dispatch pending evidence unavailable');
    const watcherError = new Error('Agent thread run id "startup-failed-run" has been aborted');

    (session as any)._rememberCompletedRun('startup-failed-run', { ok: false, err: startupError });
    (session as any)._rememberCompletedRun('startup-failed-run', { ok: false, err: watcherError });

    await expect(
      (session as any)._returnDuplicateMessageResult(
        { status: 'pending', signalId: 'startup-failed-signal', runId: 'startup-failed-run' },
        { content: 'hi' },
      ),
    ).rejects.toBe(startupError);
  });

  it('keeps the completed result when a later run watcher failure arrives', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const watcherError = new Error('Agent thread run id "completed-run" has been aborted');

    (session as any)._rememberCompletedRun('completed-run', { ok: true, full: agent.fullOutput });
    (session as any)._rememberCompletedRun('completed-run', { ok: false, err: watcherError });

    await expect(
      (session as any)._returnDuplicateMessageResult(
        { status: 'pending', signalId: 'completed-signal', runId: 'completed-run' },
        { content: 'hi' },
      ),
    ).resolves.toBe(agent.fullOutput);
  });

  it('does not return retained completed output for duplicate stream retries', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const output = buildFakeOutput({
      runId: 'retained-completed-run',
      fullOutput: agent.fullOutput,
    }) as any;
    output.status = 'success';
    vi.spyOn(agent, 'getRunOutput').mockReturnValue(output);

    await expect(
      (session as any)._returnDuplicateMessageResult(
        { status: 'pending', signalId: 'signal-1', runId: 'retained-completed-run' },
        { stream: true },
      ),
    ).rejects.toMatchObject({
      name: 'HarnessValidationError',
      message: expect.stringContaining('duplicate stream is no longer live'),
    });
  });

  it('short-circuits duplicate stream retries when pending run completion settles first', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    let resolveCompletion!: (full: unknown) => void;
    const completion = new Promise<unknown>(resolve => {
      resolveCompletion = resolve;
    });
    vi.spyOn(agent, 'getRunOutput').mockReturnValue(undefined);
    vi.spyOn(agent, 'waitForRunOutput').mockReturnValue(new Promise(() => {}));
    (session as any)._runCompletionPromises.set('settling-pending-run', {
      promise: completion,
      resolve: resolveCompletion,
      reject: vi.fn(),
    });

    const retry = (session as any)._returnDuplicateMessageResult(
      { status: 'pending', signalId: 'signal-1', runId: 'settling-pending-run' },
      { stream: true },
    );
    await nextTick();
    resolveCompletion(agent.fullOutput);

    await expect(retry).rejects.toMatchObject({
      name: 'HarnessValidationError',
      message: expect.stringContaining('duplicate stream is no longer live'),
    });
  });
});

describe('Session.message() — streaming path', () => {
  it('returns the live MastraModelOutput when stream: true', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const stream = await session.message({ content: 'go', stream: true });

    // Duck-typed output is what we returned from FakeAgent.stream — i.e. it
    // exposes the awaitable promises directly.
    expect(await (stream as any).text).toBe('hello back');
    expect(agent.calls[0]!.type).toBe('stream');
  });
});

describe('Session.message() — structured + sync path', () => {
  const Schema = z.object({ answer: z.string() });

  it('returns the parsed object via agent.generate', async () => {
    const { harness, agent } = setup();
    agent.fullOutput = { ...agent.fullOutput, object: { answer: '42' } };
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const out = await session.message({ content: 'compute', output: Schema, sync: true });

    expect(out).toEqual({ answer: '42' });
    expect(agent.calls).toHaveLength(1);
    expect(agent.calls[0]!.type).toBe('generate');
    expect(agent.calls[0]!.options.structuredOutput).toEqual({ schema: Schema });
  });

  it('rejects when sync is omitted', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.message({ content: 'compute', output: Schema } as any)).rejects.toThrow(/sync: true/);
  });

  it('rejects stream + output combination', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.message({ content: 'go', stream: true, output: Schema, sync: true } as any)).rejects.toThrow(
      /mutually exclusive/,
    );
  });

  it('rejects admissionId on the sync structured-output path', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(
      session.message({ content: 'compute', admissionId: 'admission-1', output: Schema, sync: true } as any),
    ).rejects.toBeInstanceOf(HarnessValidationError);
  });

  it('fails fast with HarnessBusyError when the session is busy (§3 / §4.4a)', async () => {
    const { harness, agent } = setup();
    agent.fullOutput = {
      ...agent.fullOutput,
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    };
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    // Park a turn so a pending interaction keeps the session busy (don't await —
    // a parked turn resolves only after resume).
    const parked = session.message({ content: 'park' });
    await new Promise(resolve => setImmediate(resolve));
    expect(session.isBusy()).toBe(true);

    await expect(session.message({ content: 'now', output: Schema, sync: true })).rejects.toBeInstanceOf(
      HarnessBusyError,
    );

    void parked.catch(() => {});
  });

  it('throws HarnessOutputGenerationError(structured_output_missing_object) when the model produces no object (§4.5)', async () => {
    const { harness, agent } = setup();
    agent.fullOutput = { ...agent.fullOutput, finishReason: 'stop', object: undefined, tripwire: undefined };
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: any[] = [];
    const off = session.subscribe(e => events.push(e));

    await expect(session.message({ content: 'compute', output: Schema, sync: true })).rejects.toMatchObject({
      name: 'HarnessOutputGenerationError',
      code: 'harness.output_generation_failed',
      reason: 'structured_output_missing_object',
      sessionId: session.id,
      runId: 'fake-run',
    });
    off();

    // The run consumed tokens even though it failed — accounting is not dropped.
    expect(session.getTokenUsage()).toMatchObject({ promptTokens: 1, completionTokens: 2, totalTokens: 3 });

    // §10.2: the failed turn surfaces an `error` agent_end carrying the run's
    // actual usage (not zero), since `full` was observed before the failure.
    const agentEnd = events.find(e => e.type === 'agent_end');
    expect(agentEnd).toMatchObject({
      finishReason: 'error',
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    });
    expect(events.some(e => e.type === 'agent_start')).toBe(true);
  });

  it('throws HarnessOutputGenerationError(tripwire) when an output processor rejects the response (§4.5)', async () => {
    const { harness, agent } = setup();
    agent.fullOutput = {
      ...agent.fullOutput,
      finishReason: 'other',
      object: undefined,
      tripwire: { reason: 'Content validation failed', processorId: 'guard' },
    };
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.message({ content: 'compute', output: Schema, sync: true })).rejects.toMatchObject({
      name: 'HarnessOutputGenerationError',
      reason: 'tripwire',
      sessionId: session.id,
    });
  });

  it('wraps an opaque generate failure as HarnessOutputGenerationError(model_error) and preserves the cause (§4.5)', async () => {
    const { harness, agent } = setup();
    const boom = new Error('model exploded');
    vi.spyOn(agent, 'generate').mockRejectedValue(boom);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const rejection = await session
      .message({ content: 'compute', output: Schema, sync: true })
      .then(() => undefined)
      .catch((err: unknown) => err);

    expect(rejection).toBeInstanceOf(HarnessOutputGenerationError);
    expect(rejection).toMatchObject({ reason: 'model_error', sessionId: session.id });
    expect((rejection as HarnessOutputGenerationError).cause).toBe(boom);
  });

  it('classifies a structured-output schema validation MastraError as structured_output_validation_failed (§4.5)', async () => {
    const { harness, agent } = setup();
    // Mirror the agent layer: schema validation surfaces a MastraError with this
    // stable id, which agent.generate() throws (stream/base/output-format-handlers.ts).
    const validationError = new MastraError({
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.SYSTEM,
      id: 'STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED',
      text: 'Structured output validation failed: - answer: Required',
    });
    vi.spyOn(agent, 'generate').mockRejectedValue(validationError);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const rejection = await session
      .message({ content: 'compute', output: Schema, sync: true })
      .then(() => undefined)
      .catch((err: unknown) => err);

    expect(rejection).toBeInstanceOf(HarnessOutputGenerationError);
    expect(rejection).toMatchObject({ reason: 'structured_output_validation_failed', sessionId: session.id });
    expect((rejection as HarnessOutputGenerationError).cause).toBe(validationError);
  });

  it('passes a harness-domain generate failure through untouched (not wrapped as model_error) (§4.5)', async () => {
    const { harness, agent } = setup();
    const domainErr = new HarnessValidationError('output', 'unsupported schema');
    vi.spyOn(agent, 'generate').mockRejectedValue(domainErr);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.message({ content: 'compute', output: Schema, sync: true })).rejects.toBe(domainErr);
  });
});

describe('Session.message() — per-turn overrides', () => {
  it('honors a `mode` override and resolves the matching agent', async () => {
    const agentA = new FakeAgent('a');
    const agentB = new FakeAgent('b');
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const harness = new Harness({
      agents: { a: agentA, b: agentB } as any,
      modes: [
        { id: 'modeA', agentId: 'a' },
        { id: 'modeB', agentId: 'b', additionalTools: { tool_b: { id: 'tool_b' } as any } },
      ],
      defaultModeId: 'modeA',
      sessions: { storage },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.message({ content: 'hi' });
    expect(agentA.calls).toHaveLength(1);
    expect(agentB.calls).toHaveLength(0);

    await session.message({ content: 'hi B', mode: 'modeB' });
    expect(agentB.calls).toHaveLength(1);
    // modeB has additionalTools — they must show up in the toolsets surface.
    expect(agentB.calls[0]!.options.toolsets).toBeDefined();
    expect(Object.keys(agentB.calls[0]!.options.toolsets)).toContain('mode:modeB:add');
  });

  it('passes per-call additionalTools alongside mode tools', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const tools = { extra: { id: 'extra' } as any };
    await session.message({ content: 'hi', additionalTools: tools });
    // Per-call additionalTools land under `call:additional`. The always-on
    // `harness:builtin` toolset (plan-task tools, §6.4) is also present.
    expect(agent.calls[0]!.options.toolsets['call:additional']).toEqual(tools);
    expect(agent.calls[0]!.options.toolsets['harness:builtin']).toBeDefined();
  });

  it('marks mode.tools as replacement while additionalTools keeps merge semantics', async () => {
    const agent = new FakeAgent('default');
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [
        { id: 'replace', agentId: 'default', tools: { modeTool: { id: 'modeTool' } as any } },
        { id: 'augment', agentId: 'default', additionalTools: { extraTool: { id: 'extraTool' } as any } },
      ],
      defaultModeId: 'replace',
      sessions: { storage: new InMemoryHarness({ db: new InMemoryDB() }) },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.message({ content: 'replace' });
    await session.message({ content: 'augment', mode: 'augment' });

    expect(agent.calls[0]!.options.toolsetsMode).toBe('replace');
    expect(agent.calls[1]!.options.toolsetsMode).toBeUndefined();
  });

  it('can exclude Harness built-ins, including from an explicitly empty replacement mode', async () => {
    const agent = new FakeAgent('default');
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'empty', agentId: 'default', tools: {}, harnessBuiltins: 'exclude' }],
      defaultModeId: 'empty',
      sessions: { storage: new InMemoryHarness({ db: new InMemoryDB() }) },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.message({ content: 'empty' });

    expect(agent.calls[0]!.options.toolsetsMode).toBe('replace');
    expect(agent.calls[0]!.options.toolsets).toEqual({});
  });

  it('passes modelSettings to sync structured generation only when provided', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const Schema = z.object({ ok: z.boolean() });
    agent.fullOutput = {
      ...agent.fullOutput,
      object: { ok: true },
    };

    await session.message({ content: 'compute', output: Schema, sync: true });
    await session.message({
      content: 'compute again',
      output: Schema,
      sync: true,
      modelSettings: { temperature: 0.2, maxOutputTokens: 128 },
    });

    expect(agent.calls[0]!.options.modelSettings).toBeUndefined();
    expect(agent.calls[1]!.options.modelSettings).toEqual({ temperature: 0.2, maxOutputTokens: 128 });
  });
});

describe('Session.message() — closed sessions reject', () => {
  it('throws when called on a closed session', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await harness.closeSession({ sessionId: session.id });

    await expect(session.message({ content: 'hi' })).rejects.toThrow(/closed/);
  });
});

describe('session.message admission phase marks (PF-2246)', () => {
  it('reports the ordered pre-stream phases exactly once on a streamed admission turn', async () => {
    const agent = new LiveStreamFakeAgent('default');
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const phases: Array<{ elapsedMs: number; phase: string }> = [];

    const stream = await session.message({
      content: 'hi',
      admissionId: 'admission-phase-marks',
      stream: true,
      onPhase: (phase, elapsedMs) => phases.push({ elapsedMs, phase }),
    });
    expect(stream).toBeDefined();

    expect(phases.map(entry => entry.phase)).toEqual([
      'admission_duplicate_resolved',
      'tool_surface_built',
      'request_context_ready',
      'evidence_reserved',
      'agent_dispatched',
      'output_registered',
    ]);
    for (const entry of phases) {
      expect(entry.elapsedMs).toBeGreaterThanOrEqual(0);
    }

    agent.releaseStream?.();
    await session.waitForIdle({ timeoutMs: 1_000 });
  });

  it('never lets a throwing onPhase callback affect the turn', async () => {
    const agent = new LiveStreamFakeAgent('default');
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const stream = await session.message({
      content: 'hi',
      admissionId: 'admission-phase-throws',
      stream: true,
      onPhase: () => {
        throw new Error('observability must never break the turn');
      },
    });
    expect(stream).toBeDefined();

    agent.releaseStream?.();
    await session.waitForIdle({ timeoutMs: 1_000 });
  });
});
