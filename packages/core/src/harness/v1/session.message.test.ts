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
import { AgentThreadOutputDrainError } from '../../agent/thread-stream-runtime';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import {
  HarnessStorageAdmissionConflictError,
  HarnessStorageVersionConflictError,
  harnessTerminalAdmissionId,
  harnessTerminalIntentId,
} from '../../storage/domains/harness';
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

  it('commits the caller seed, canonical result, and exact terminal intent through one native handoff', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const finalizerCalls: Array<{ seed: unknown; finalizerId: string; finalizerVersion: string }> = [];
    const { harness, agent } = setupHarness({
      agents: { default: new MockAgent({ id: 'default', defaultOutput: { text: 'hello back' } }) },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async input => {
              finalizerCalls.push({
                seed: input.seed,
                finalizerId: input.finalizerId,
                finalizerVersion: input.finalizerVersion,
              });
              return {
                projectionKind: 'chat.summary',
                projectionId: 'response-1',
                payload: { seed: input.seed, terminalStatus: input.result.status },
              };
            },
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const seed = { collector: { responseId: 'response-1' }, schemaVersion: 2 };
    const result = await session.message({
      content: 'native terminal',
      admissionId: 'native-terminal-admission',
      executionAuthorityGrant: { key: 'usage-claim-1', generation: 7 },
      terminalAdmissionSeed: seed,
    });

    expect(result.text).toBe('hello back');
    expect(agent.streamCalls).toHaveLength(1);
    expect(finalizerCalls).toEqual([{ seed, finalizerId: 'doxa.chat', finalizerVersion: '2026-09-20' }]);
    const intent = await storage.loadTerminalIntent({
      harnessName: 'default',
      intentId: harnessTerminalIntentId(
        harnessTerminalAdmissionId({
          harnessName: 'default',
          sessionId: session.id,
          executionGrant: { key: 'usage-claim-1', generation: 7 },
        }),
      ),
    });
    expect(intent).toMatchObject({
      projection: {
        projectionKind: 'chat.summary',
        projectionId: 'response-1',
        payload: { seed, terminalStatus: 'completed' },
      },
    });
    expect(intent).toBeDefined();
    await expect(session.lookupMessageResult(intent!.signalId)).resolves.toMatchObject({ status: 'completed' });
  });

  it('holds a live duplicate behind the durable terminal commit barrier', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    let releaseRun!: () => void;
    let releaseFinalizer!: () => void;
    let finalizerEntered!: () => void;
    const runGate = new Promise<void>(resolve => {
      releaseRun = resolve;
    });
    const finalizerGate = new Promise<void>(resolve => {
      releaseFinalizer = resolve;
    });
    const finalizerStarted = new Promise<void>(resolve => {
      finalizerEntered = resolve;
    });
    agent.enqueueRun({ holdUntil: runGate, text: 'terminal done' });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async input => {
              finalizerEntered();
              await finalizerGate;
              return {
                projectionKind: 'chat.summary',
                projectionId: 'response-1',
                payload: { terminalStatus: input.result.status },
              };
            },
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-live', generation: 3 };
    const opts = {
      content: 'go',
      admissionId: 'live-duplicate',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    } as const;
    const first = session.message({ ...opts });
    await vi.waitFor(() => expect(agent.streamCalls).toHaveLength(1));

    // The provider run is still live — the duplicate attaches to it.
    const second = session.message({ ...opts });
    let secondSettled = false;
    void second.then(
      () => {
        secondSettled = true;
      },
      () => {
        secondSettled = true;
      },
    );

    // The run completes, but the durable commit stays blocked behind the
    // finalizer: the duplicate must not report provider completion early.
    releaseRun();
    await finalizerStarted;
    await new Promise(resolve => setTimeout(resolve, 25));
    expect(secondSettled).toBe(false);
    const pendingAdmission = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'live-duplicate',
      executionGrant: grant,
    });
    expect(pendingAdmission?.status).toBe('pending');
    await expect(
      storage.loadTerminalIntent({
        harnessName: 'default',
        intentId: harnessTerminalIntentId(
          harnessTerminalAdmissionId({
            harnessName: 'default',
            sessionId: session.id,
            executionGrant: grant,
          }),
        ),
      }),
    ).resolves.toBeNull();

    releaseFinalizer();
    await expect(first).resolves.toMatchObject({ text: 'terminal done' });
    await expect(second).resolves.toMatchObject({ text: 'terminal done' });
    const committed = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'live-duplicate',
      executionGrant: grant,
    });
    expect(committed?.status).toBe('committed');
    expect(agent.streamCalls).toHaveLength(1);
  });

  it('defers terminal settlement while suspended and commits on resume completion', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    agent.enqueueRun({ finishReason: 'stop', text: 'resumed answer' });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async input => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: { terminalStatus: input.result.status },
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-suspended', generation: 1 };
    const result = await session.message({
      content: 'needs approval',
      admissionId: 'suspendable-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(result.finishReason).toBe('suspended');

    // Suspension is not a terminal winner: the admission stays pending and no
    // delivery intent is minted while approval is outstanding.
    const admission = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'suspendable-admission',
      executionGrant: grant,
    });
    expect(admission?.status).toBe('pending');
    await expect(
      storage.loadTerminalIntent({
        harnessName: 'default',
        intentId: harnessTerminalIntentId(
          harnessTerminalAdmissionId({
            harnessName: 'default',
            sessionId: session.id,
            executionGrant: grant,
          }),
        ),
      }),
    ).resolves.toBeNull();

    // The approval-gated resume is the admission's real terminal outcome.
    await session.respondToToolApproval({ approved: true });
    const settled = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'suspendable-admission',
      executionGrant: grant,
    });
    expect(settled?.status).toBe('committed');
    expect(settled?.terminalResult).toMatchObject({ status: 'completed', runId: admission!.runId });
    const intent = await storage.loadTerminalIntent({
      harnessName: 'default',
      intentId: harnessTerminalIntentId(admission!.id),
    });
    expect(intent?.terminalResult).toMatchObject({ status: 'completed' });
  });

  it('commits a failed terminal result for an error-finished run', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({ finishReason: 'error', text: '' });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async input => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: { terminalStatus: input.result.status },
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-error', generation: 1 };
    const result = await session.message({
      content: 'will fail',
      admissionId: 'error-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });

    const admission = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'error-admission',
      executionGrant: grant,
    });
    expect(admission?.status).toBe('committed');
    expect(admission?.terminalResult).toMatchObject({
      status: 'failed',
      finishReason: 'error',
      runId: result.runId,
    });
    expect(admission?.terminalResult?.error).toBeDefined();
  });

  it('re-drives dispatch when a prior attempt stranded between reservation and terminal admission', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default', defaultOutput: { text: 'recovered' } });
    let admitAttempts = 0;
    const realAdmit = storage.admitTerminalHandoff.bind(storage);
    vi.spyOn(storage, 'admitTerminalHandoff').mockImplementation(async input => {
      admitAttempts += 1;
      if (admitAttempts === 1) {
        throw new Error('transient admission failure');
      }
      return realAdmit(input);
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async input => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: { terminalStatus: input.result.status },
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-retry', generation: 1 };
    const opts = {
      content: 'retry me',
      admissionId: 'stranded-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    } as const;

    // The first attempt reserves pending evidence, then dies inside terminal
    // admission before the provider run ever dispatches.
    await expect(session.message({ ...opts })).rejects.toBeTruthy();
    expect(agent.streamCalls).toHaveLength(0);
    await expect(
      storage.loadTerminalAdmission({
        harnessName: 'default',
        sessionId: session.id,
        admissionId: 'stranded-admission',
        executionGrant: grant,
      }),
    ).resolves.toBeNull();

    // The retry must recover the stranded reservation instead of waiting on a
    // settlement that can never arrive.
    const second = await session.message({ ...opts });
    expect(second.text).toBe('recovered');
    expect(agent.streamCalls).toHaveLength(1);
    const committed = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'stranded-admission',
      executionGrant: grant,
    });
    expect(committed?.status).toBe('committed');
    const intent = await storage.loadTerminalIntent({
      harnessName: 'default',
      intentId: harnessTerminalIntentId(committed!.id),
    });
    expect(intent?.terminalResult).toMatchObject({ status: 'completed' });
  });

  it('rejects a terminal admission that would fold into an active run', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    let releaseRun!: () => void;
    const runGate = new Promise<void>(resolve => {
      releaseRun = resolve;
    });
    agent.enqueueRun({ holdUntil: runGate, text: 'first done' });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const first = session.message({ content: 'first', admissionId: 'first-run' });
    await vi.waitFor(() => expect(agent.streamCalls).toHaveLength(1));

    // The admission binds its grant to a fresh run — folding into the live one
    // would leave the grant keyed to a runId that never owns its settlement.
    await expect(
      session.message({
        content: 'fold me',
        admissionId: 'fold-admission',
        executionAuthorityGrant: { key: 'usage-claim-fold', generation: 1 },
        terminalAdmissionSeed: { v: 1 },
      }),
    ).rejects.toBeInstanceOf(HarnessConfigError);
    expect(agent.streamCalls).toHaveLength(1);

    releaseRun();
    await expect(first).resolves.toMatchObject({ text: 'first done' });
  });

  it('replays the durable receipt to a settled retry’s terminal observer', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const { harness, agent } = setupHarness({
      agents: { default: new MockAgent({ id: 'default', defaultOutput: { text: 'done' } }) },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-replay', generation: 1 };
    const opts = {
      content: 'once',
      admissionId: 'replay-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    } as const;
    await session.message({ ...opts });

    const receipts: string[] = [];
    const retry = await session.message({ ...opts, onTerminalCommit: r => receipts.push(r.status) });
    expect(retry.text).toBe('done');
    expect(receipts).toEqual(['duplicate']);
    expect(agent.streamCalls).toHaveLength(1);
  });

  it('notifies a live stream duplicate’s terminal observers when the winner commits', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    let releaseRun!: () => void;
    const runGate = new Promise<void>(resolve => {
      releaseRun = resolve;
    });
    agent.enqueueRun({ holdUntil: runGate, text: 'streamed done' });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-stream', generation: 1 };
    const opts = {
      content: 'stream go',
      admissionId: 'stream-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
      stream: true,
    } as const;
    const first = await session.message({ ...opts });
    await vi.waitFor(() => expect(agent.streamCalls).toHaveLength(1));

    const receipts: string[] = [];
    const duplicate = await session.message({ ...opts, onTerminalCommit: r => receipts.push(r.status) });
    expect(duplicate).toBe(first);

    releaseRun();
    await vi.waitFor(() => expect(receipts.length).toBeGreaterThan(0));
    expect(receipts[0]).toBe('committed');
  });

  it('re-drives dispatch when the durable dispatch marker never stamped', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default', defaultOutput: { text: 'recovered' } });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-lost-ack', generation: 1 };
    const opts = {
      content: 'lost ack',
      admissionId: 'lost-ack-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    } as const;

    // The first attempt admits the grant row, then dies writing the durable
    // dispatch marker — the provider was provably never invoked, so a retry
    // may safely re-drive the admission and dispatch.
    const originalCas = storage.compareAndSwapSignalDispatch.bind(storage);
    let markerWriteAttempted = false;
    vi.spyOn(storage, 'compareAndSwapSignalDispatch').mockImplementation(async input => {
      if (!markerWriteAttempted && input.operationKind === 'message' && input.next.state === 'dispatching') {
        markerWriteAttempted = true;
        throw new Error('dispatch marker write lost');
      }
      return originalCas(input);
    });
    await expect(session.message({ ...opts })).rejects.toThrow('An internal harness error occurred');
    vi.restoreAllMocks();
    const pending = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'lost-ack-admission',
      executionGrant: grant,
    });
    expect(pending?.status).toBe('pending');
    expect(agent.streamCalls).toHaveLength(0);

    const second = await session.message({ ...opts });
    expect(second.text).toBe('recovered');
    expect(agent.streamCalls).toHaveLength(1);
    const committed = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'lost-ack-admission',
      executionGrant: grant,
    });
    expect(committed?.status).toBe('committed');
  });

  it('does not re-dispatch the provider when the durable dispatch marker stamped', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default', defaultOutput: { text: 'must not run' } });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-maybe-dispatched', generation: 1 };
    const opts = {
      content: 'maybe dispatched',
      admissionId: 'maybe-dispatched-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    } as const;

    // The marker lands before sendSignal — a sendSignal throw after that point
    // cannot prove the provider never ran (the acknowledgement may simply be
    // lost). The pending admission is ambiguous and must never auto-replay.
    const sendSpy = vi.spyOn(agent, 'sendSignal').mockImplementationOnce(() => {
      throw new Error('dispatch acknowledgement lost');
    });
    await expect(session.message({ ...opts })).rejects.toBeTruthy();
    sendSpy.mockRestore();
    const pending = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'maybe-dispatched-admission',
      executionGrant: grant,
    });
    expect(pending?.status).toBe('pending');

    vi.useFakeTimers();
    try {
      const second = session.message({ ...opts });
      void second.catch(() => {});
      // The retry waits on durable settlement instead of executing the
      // provider a second time — the admission stays pending for
      // reconciliation and the wait eventually reports the admission as dead.
      await vi.advanceTimersByTimeAsync(31_000);
      await expect(second).rejects.toThrow('pending message admission is not live');
    } finally {
      vi.useRealTimers();
    }
    expect(agent.streamCalls).toHaveLength(0);
    expect(agent.resumeCalls).toHaveLength(0);
    const stillPending = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'maybe-dispatched-admission',
      executionGrant: grant,
    });
    expect(stillPending?.status).toBe('pending');
  });

  it('settles a retried resume from the cached run output without re-running the provider', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    agent.enqueueRun({ finishReason: 'stop', text: 'resumed answer' });
    let finalizeAttempts = 0;
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => {
              finalizeAttempts += 1;
              if (finalizeAttempts === 1) throw new Error('transient finalizer failure');
              return {
                projectionKind: 'chat.summary',
                projectionId: 'response-1',
                payload: {},
              };
            },
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-resume-retry', generation: 1 };
    const result = await session.message({
      content: 'needs approval',
      admissionId: 'resume-retry-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(result.finishReason).toBe('suspended');

    // The resumed provider run completes but the deferred settlement fails —
    // `resumedAt` is durable, so a naive retry would be told "awaiting agent
    // confirmation" forever.
    await expect(session.respondToToolApproval({ approved: true })).rejects.toThrow(
      'Native terminal finalization is indeterminate and requires reconciliation',
    );
    expect(agent.resumeCalls).toHaveLength(1);

    // The settlement-only retry commits the SAME completed run output — the
    // provider is never invoked again.
    const retried = await session.respondToToolApproval({ approved: true });
    expect(retried.text).toBe('resumed answer');
    expect(agent.resumeCalls).toHaveLength(1);
    expect(agent.streamCalls).toHaveLength(1);
    expect(finalizeAttempts).toBe(2);

    const settled = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'resume-retry-admission',
      executionGrant: grant,
    });
    expect(settled?.status).toBe('committed');
    const record = await storage.loadSession({ harnessName: 'default', sessionId: session.id });
    expect(record?.pendingResume).toBeUndefined();
  });

  it('cancels the deferred terminal admission and drains observers when the suspended turn is aborted', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-abort', generation: 1 };
    const failures: Error[] = [];
    const result = await session.message({
      content: 'needs approval',
      admissionId: 'abort-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
      onTerminalCommitError: err => failures.push(err),
    });
    expect(result.finishReason).toBe('suspended');
    const admission = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'abort-admission',
      executionGrant: grant,
    });
    expect(admission?.status).toBe('pending');

    await session.abortActiveWork();

    const cancelled = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'abort-admission',
      executionGrant: grant,
    });
    expect(cancelled?.status).toBe('cancelled');
    // The retained observer sees the durable cancellation exactly once instead
    // of waiting on a settlement that can no longer arrive.
    expect(failures).toHaveLength(1);
    expect(failures[0]!.name).toBe('HarnessTerminalHandoffError:harness.terminal_cancelled');
  });

  it('replays the committed terminal receipt before rejecting an expired duplicate stream', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default', defaultOutput: { text: 'streamed' } });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-receipt-replay', generation: 1 };
    const opts = {
      content: 'receipt replay',
      admissionId: 'receipt-replay-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    } as const;
    const first = await session.message({ ...opts });
    expect(first.text).toBe('streamed');
    const committed = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'receipt-replay-admission',
      executionGrant: grant,
    });
    expect(committed?.status).toBe('committed');

    // The run is over, so the stream shape is unavailable — but the durable
    // receipt must still reach this retry's observer before the rejection.
    // The replayed receipt reports 'duplicate': this caller converged on the
    // sealed winner rather than committing its own result.
    const receipts: string[] = [];
    await expect(
      session.message({ ...opts, stream: true, onTerminalCommit: r => receipts.push(r.status) }),
    ).rejects.toThrow('duplicate stream is no longer live');
    expect(receipts).toEqual(['duplicate']);
  });

  it('converges concurrent terminal committers on a single finalizer run', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    let releaseRun!: () => void;
    let releaseFinalizer!: () => void;
    let finalizerEntered!: () => void;
    const entered = new Promise<void>(resolve => {
      finalizerEntered = resolve;
    });
    const finalizerGate = new Promise<void>(resolve => {
      releaseFinalizer = resolve;
    });
    let finalizerCalls = 0;
    agent.enqueueRun({
      holdUntil: new Promise<void>(resolve => {
        releaseRun = resolve;
      }),
      text: 'shared winner',
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => {
              finalizerCalls += 1;
              finalizerEntered();
              await finalizerGate;
              return {
                projectionKind: 'chat.summary',
                projectionId: 'response-1',
                payload: {},
              };
            },
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-concurrent', generation: 1 };
    const opts = {
      content: 'concurrent',
      admissionId: 'concurrent-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    } as const;
    const first = session.message({ ...opts });
    await vi.waitFor(() => expect(agent.streamCalls).toHaveLength(1));
    const receipts: string[] = [];
    const second = session.message({ ...opts, onTerminalCommit: r => receipts.push(r.status) });

    releaseRun();
    // Wait until the finalizer is actually running, then let it finish while
    // the duplicate's commit attempt is queued behind the in-flight one.
    await entered;
    releaseFinalizer();

    await expect(first).resolves.toMatchObject({ text: 'shared winner' });
    await expect(second).resolves.toMatchObject({ text: 'shared winner' });
    // One in-flight settlement per admission: the duplicate joins the winner's
    // commit instead of racing a divergent terminalResult into a conflict.
    expect(finalizerCalls).toBe(1);
    expect(receipts).toEqual(['committed']);
    const committed = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'concurrent-admission',
      executionGrant: grant,
    });
    expect(committed?.status).toBe('committed');
  });

  it('does not restore an obsolete suspension over a newer durable pending resume', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-A', toolName: 'shell', args: { cmd: 'a' } },
    });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-B', toolName: 'shell', args: { cmd: 'b' } },
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-stale-suspend', generation: 1 };
    const opts = {
      content: 'double suspend',
      admissionId: 'stale-suspend-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    } as const;

    const first = await session.message({ ...opts });
    expect(first.finishReason).toBe('suspended');
    // Resume once: the run suspends again at a NEWER interaction (tc-B).
    const second = await session.respondToToolApproval({ approved: true });
    expect(second.finishReason).toBe('suspended');
    const parked = (await storage.loadSession({ harnessName: 'default', sessionId: session.id }))?.pendingResume;
    expect(parked?.toolCallId).toBe('tc-B');

    // A message retry must not let the cached first-generation suspension (A)
    // overwrite the durable park for B.
    const duplicate = await session.message({ ...opts });
    expect(duplicate.finishReason).toBe('suspended');
    const stillParked = (await storage.loadSession({ harnessName: 'default', sessionId: session.id }))?.pendingResume;
    expect(stillParked?.toolCallId).toBe('tc-B');
  });

  it('drains retained terminal observers with an indeterminate outcome when the session closes', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-teardown', generation: 1 };
    const failures: Error[] = [];
    const result = await session.message({
      content: 'needs approval',
      admissionId: 'teardown-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
      onTerminalCommitError: err => failures.push(err),
    });
    expect(result.finishReason).toBe('suspended');

    await session.close();

    expect(failures).toHaveLength(1);
    expect(failures[0]!.name).toBe('HarnessTerminalHandoffError:harness.terminal_pending');
  });

  it('keeps resume recovery state when resumed terminal settlement fails', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    agent.enqueueRun({ finishReason: 'stop', text: 'resumed answer' });
    let finalizeAttempts = 0;
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => {
              finalizeAttempts += 1;
              if (finalizeAttempts === 1) throw new Error('transient finalizer failure');
              return {
                projectionKind: 'chat.summary',
                projectionId: 'response-1',
                payload: {},
              };
            },
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-resume-fail', generation: 1 };
    const result = await session.message({
      content: 'needs approval',
      admissionId: 'resume-fail-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(result.finishReason).toBe('suspended');

    // The deferred commit fails — the pending resume state must survive so a
    // later approval (after the stale-admission recovery window) can still
    // reach the settlement. If the flush had already cleared pendingResume and
    // marked the response applied, the admission would be stranded forever.
    await expect(session.respondToToolApproval({ approved: true })).rejects.toBeTruthy();
    const admission = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'resume-fail-admission',
      executionGrant: grant,
    });
    expect(admission?.status).toBe('pending');
    const record = await storage.loadSession({ harnessName: 'default', sessionId: session.id });
    expect(record?.pendingResume).toBeDefined();
    expect(record?.pendingResume?.runId).toBe(admission!.runId);
  });

  it('cancels the deferred terminal admission when the session is cancelled', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-session-cancel', generation: 1 };
    const failures: Error[] = [];
    const result = await session.message({
      content: 'needs approval',
      admissionId: 'session-cancel-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
      onTerminalCommitError: err => failures.push(err),
    });
    expect(result.finishReason).toBe('suspended');
    const pending = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'session-cancel-admission',
      executionGrant: grant,
    });
    expect(pending?.status).toBe('pending');

    await session.cancel({ reason: 'user cancelled' });

    const cancelled = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'session-cancel-admission',
      executionGrant: grant,
    });
    expect(cancelled?.status).toBe('cancelled');
    expect(failures).toHaveLength(1);
    expect(failures[0]!.name).toBe('HarnessTerminalHandoffError:harness.terminal_cancelled');
  });

  it('finishes retried resume bookkeeping without re-running the provider or double-accounting usage', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
      usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
    });
    agent.enqueueRun({
      finishReason: 'stop',
      text: 'resumed answer',
      usage: { inputTokens: 4, outputTokens: 5, totalTokens: 9 },
      totalUsage: { inputTokens: 6, outputTokens: 8, totalTokens: 14 },
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-committed-retry', generation: 1 };
    const result = await session.message({
      content: 'needs approval',
      admissionId: 'committed-retry-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(result.finishReason).toBe('suspended');
    expect((await storage.loadSession({ harnessName: 'default', sessionId: session.id }))?.tokenUsage.totalTokens).toBe(
      5,
    );

    // The terminal commit seals the grant, then the pendingResume-clearing
    // flush is lost. `resumedAt` and the committed row are both durable, so
    // the retry must finish the remaining bookkeeping off the cached run —
    // not re-run the provider, and not re-apply the resumed usage delta.
    const originalCommit = storage.commitTerminalHandoff.bind(storage);
    let commitSealed = false;
    vi.spyOn(storage, 'commitTerminalHandoff').mockImplementation(async input => {
      const receipt = await originalCommit(input);
      commitSealed = true;
      return receipt;
    });
    const originalSave = storage.saveSession.bind(storage);
    let failedOnce = false;
    vi.spyOn(storage, 'saveSession').mockImplementation(async (record: any, opts?: any) => {
      if (commitSealed && !failedOnce) {
        failedOnce = true;
        throw new Error('pendingResume flush lost');
      }
      return originalSave(record, opts);
    });

    await expect(session.respondToToolApproval({ approved: true })).rejects.toThrow(
      'An internal harness error occurred',
    );
    expect(agent.resumeCalls).toHaveLength(1);
    const sealed = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'committed-retry-admission',
      executionGrant: grant,
    });
    expect(sealed?.status).toBe('committed');
    expect((await storage.loadSession({ harnessName: 'default', sessionId: session.id }))?.pendingResume).toBeDefined();

    vi.restoreAllMocks();
    const retried = await session.respondToToolApproval({ approved: true });
    expect(retried.text).toBe('resumed answer');
    expect(agent.resumeCalls).toHaveLength(1);
    expect(agent.streamCalls).toHaveLength(1);
    const after = await storage.loadSession({ harnessName: 'default', sessionId: session.id });
    expect(after?.pendingResume).toBeUndefined();
    // Suspended segment (5) + resumed remainder (14-5) applied exactly once.
    expect(after?.tokenUsage.totalTokens).toBe(14);
  });

  it('parks the pending resume from an adopted duplicate stream when the original bookkeeping died', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    let releaseRun!: () => void;
    agent.enqueueRun({
      holdUntil: new Promise<void>(resolve => {
        releaseRun = resolve;
      }),
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-adopted', generation: 1 };
    const opts = {
      content: 'suspending stream',
      admissionId: 'adopted-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
      stream: true,
    } as const;

    const first = await session.message({ ...opts });
    await vi.waitFor(() => expect(agent.streamCalls).toHaveLength(1));
    // The duplicate adopts the still-live run's stream.
    const second = await session.message({ ...opts });
    expect(second).toBe(first);

    // Kill the original caller's suspend-capture flush: its bookkeeping dies
    // before pendingResume is parked, leaving settlement to the adoptee.
    const originalSave = storage.saveSession.bind(storage);
    let failedOnce = false;
    vi.spyOn(storage, 'saveSession').mockImplementation(async (record: any, o?: any) => {
      if (!failedOnce) {
        failedOnce = true;
        throw new Error('suspend capture flush lost');
      }
      return originalSave(record, o);
    });

    releaseRun();
    await vi.waitFor(async () => {
      const record = await storage.loadSession({ harnessName: 'default', sessionId: session.id });
      expect(record?.pendingResume?.toolCallId).toBe('tc-1');
    });
    vi.restoreAllMocks();

    // The adoptee's commit defers on the suspended output — the grant stays
    // pending for the approval-gated resume instead of sealing a false winner.
    const admission = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'adopted-admission',
      executionGrant: grant,
    });
    expect(admission?.status).toBe('pending');
  });

  it('does not resurrect a suspended turn when its deferred admission was cancelled', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-cancelled-park', generation: 1 };
    const opts = {
      content: 'needs approval',
      admissionId: 'cancelled-park-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    } as const;
    const result = await session.message({ ...opts });
    expect(result.finishReason).toBe('suspended');

    await session.abortActiveWork();
    const cancelled = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'cancelled-park-admission',
      executionGrant: grant,
    });
    expect(cancelled?.status).toBe('cancelled');
    expect(
      (await storage.loadSession({ harnessName: 'default', sessionId: session.id }))?.pendingResume,
    ).toBeUndefined();

    // The duplicate retry must surface the cancelled outcome and must NOT
    // re-park the cached suspension — a restored pendingResume would let a
    // later respond drive resumeStream against the revoked grant.
    await expect(session.message({ ...opts })).rejects.toMatchObject({
      name: 'HarnessTerminalHandoffError:harness.terminal_cancelled',
    });
    expect(
      (await storage.loadSession({ harnessName: 'default', sessionId: session.id }))?.pendingResume,
    ).toBeUndefined();
    expect(agent.resumeCalls).toHaveLength(0);
  });

  it('rejects a resume whose deferred admission was cancelled without invoking the provider', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-dead-resume', generation: 1 };
    const failures: Error[] = [];
    const result = await session.message({
      content: 'needs approval',
      admissionId: 'dead-resume-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
      onTerminalCommitError: err => failures.push(err),
    });
    expect(result.finishReason).toBe('suspended');
    const pending = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'dead-resume-admission',
      executionGrant: grant,
    });
    expect(pending?.status).toBe('pending');

    // An external teardown (abort/cancel/fencing) revokes the grant while the
    // parked interaction survives — the respond must surface the terminal
    // outcome instead of resuming the provider against a dead grant.
    await storage.cancelTerminalHandoff({
      harnessName: pending!.harnessName,
      sessionId: pending!.sessionId,
      sessionIncarnation: pending!.sessionIncarnation,
      admissionId: pending!.admissionId,
      admissionHash: pending!.admissionHash,
      executionGrant: pending!.executionGrant,
      reason: { code: 'harness.terminal_cancelled', message: 'revoked' },
    });

    await expect(session.respondToToolApproval({ approved: true })).rejects.toMatchObject({
      name: 'HarnessTerminalHandoffError:harness.terminal_cancelled',
    });
    expect(agent.resumeCalls).toHaveLength(0);
    // The pending row stays discoverable for reconciliation.
    expect((await storage.loadSession({ harnessName: 'default', sessionId: session.id }))?.pendingResume).toBeDefined();
    expect(failures).toHaveLength(1);
    expect(failures[0]!.name).toBe('HarnessTerminalHandoffError:harness.terminal_cancelled');
  });

  it('propagates a cancellation that lands while the resumed run is executing', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    agent.enqueueRun({ finishReason: 'stop', text: 'resumed answer' });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-mid-resume-cancel', generation: 1 };
    const result = await session.message({
      content: 'needs approval',
      admissionId: 'mid-resume-cancel-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(result.finishReason).toBe('suspended');
    const pending = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'mid-resume-cancel-admission',
      executionGrant: grant,
    });
    expect(pending?.status).toBe('pending');

    // Land the cancellation after the pre-resume probe but before the
    // settlement probe — the second by-run load is the deferred settle.
    const originalProbe = storage.loadTerminalAdmissionByRun.bind(storage);
    let probes = 0;
    vi.spyOn(storage, 'loadTerminalAdmissionByRun').mockImplementation(async input => {
      probes += 1;
      if (probes === 2) {
        await storage.cancelTerminalHandoff({
          harnessName: pending!.harnessName,
          sessionId: pending!.sessionId,
          sessionIncarnation: pending!.sessionIncarnation,
          admissionId: pending!.admissionId,
          admissionHash: pending!.admissionHash,
          executionGrant: pending!.executionGrant,
          reason: { code: 'harness.terminal_cancelled', message: 'revoked mid-resume' },
        });
      }
      return originalProbe(input);
    });

    await expect(session.respondToToolApproval({ approved: true })).rejects.toMatchObject({
      name: 'HarnessTerminalHandoffError:harness.terminal_cancelled',
    });
    vi.restoreAllMocks();
    // The provider did run — the cancel raced mid-resume — but the outcome is
    // the revoked grant's terminal state, not a false success.
    expect(agent.resumeCalls).toHaveLength(1);
    expect((await storage.loadSession({ harnessName: 'default', sessionId: session.id }))?.pendingResume).toBeDefined();
  });

  it('finishes retried resume bookkeeping from durable evidence after a cold restart', async () => {
    const db = new InMemoryDB();
    const storage1 = new InMemoryHarness({
      db,
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent1 = new MockAgent({ id: 'default' });
    agent1.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    agent1.enqueueRun({ finishReason: 'stop', text: 'resumed answer' });
    const { harness: harness1 } = setupHarness({
      agents: { default: agent1 },
      sessions: {
        storage: storage1,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session1 = await harness1.session({ resourceId: 'u1', threadId: { fresh: true } });
    const sessionId = session1.id;
    const grant = { key: 'usage-claim-restart-retry', generation: 1 };
    const result = await session1.message({
      content: 'needs approval',
      admissionId: 'restart-retry-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(result.finishReason).toBe('suspended');

    // Commit seals the grant, then the pendingResume-clearing flush is lost.
    const originalCommit = storage1.commitTerminalHandoff.bind(storage1);
    let commitSealed = false;
    vi.spyOn(storage1, 'commitTerminalHandoff').mockImplementation(async input => {
      const receipt = await originalCommit(input);
      commitSealed = true;
      return receipt;
    });
    const originalSave = storage1.saveSession.bind(storage1);
    let failedOnce = false;
    vi.spyOn(storage1, 'saveSession').mockImplementation(async (record: any, opts?: any) => {
      if (commitSealed && !failedOnce) {
        failedOnce = true;
        throw new Error('pendingResume flush lost');
      }
      return originalSave(record, opts);
    });
    await expect(session1.respondToToolApproval({ approved: true })).rejects.toThrow(
      'An internal harness error occurred',
    );
    vi.restoreAllMocks();
    const sealed = await storage1.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: sessionId,
      admissionId: 'restart-retry-admission',
      executionGrant: grant,
    });
    expect(sealed?.status).toBe('committed');
    await harness1.shutdown();

    // Cold restart: a fresh session object has an empty _completedRuns cache —
    // the retry must settle from the committed admission's durable canonical
    // evidence rather than reporting the resume as abandoned.
    const storage2 = new InMemoryHarness({
      db,
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent2 = new MockAgent({ id: 'default' });
    const { harness: harness2 } = setupHarness({
      agents: { default: agent2 },
      sessions: {
        storage: storage2,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    try {
      const session2 = await harness2.session({ sessionId, resourceId: 'u1' });
      const retried = await session2.respondToToolApproval({ approved: true });
      expect(retried.text).toBe('resumed answer');
      expect(agent2.resumeCalls).toHaveLength(0);
      expect(agent2.streamCalls).toHaveLength(0);
      expect((await storage2.loadSession({ harnessName: 'default', sessionId }))?.pendingResume).toBeUndefined();
    } finally {
      await harness2.shutdown();
    }
  });

  it('emits agent_end exactly once when a settlement retry converges with the winner', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    agent.enqueueRun({ finishReason: 'stop', text: 'resumed answer' });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-double-emit', generation: 1 };
    const result = await session.message({
      content: 'needs approval',
      admissionId: 'double-emit-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(result.finishReason).toBe('suspended');
    const events: any[] = [];
    const off = session.subscribe(e => events.push(e));

    // Hold the winner inside its pendingResume-clearing flush AFTER the durable
    // commit sealed: a concurrent retry that already captured the parked
    // (resumed) interaction probes the sealed admission, re-enters the shared
    // finalize helper, and must NOT emit a second agent_end.
    let releaseFlush!: () => void;
    const flushGate = new Promise<void>(resolve => (releaseFlush = resolve));
    let commitSealed = false;
    let flushHeld = false;
    const originalCommit = storage.commitTerminalHandoff.bind(storage);
    vi.spyOn(storage, 'commitTerminalHandoff').mockImplementation(async input => {
      const receipt = await originalCommit(input);
      if (receipt.status === 'committed') commitSealed = true;
      return receipt;
    });
    const originalSave = storage.saveSession.bind(storage);
    vi.spyOn(storage, 'saveSession').mockImplementation(async (record: any, opts?: any) => {
      if (commitSealed && record.pendingResume === undefined && !flushHeld) {
        flushHeld = true;
        await flushGate;
      }
      return originalSave(record, opts);
    });

    const respond1 = session.respondToToolApproval({ approved: true });
    await vi.waitFor(() => expect(commitSealed).toBe(true));
    const respond2 = session.respondToToolApproval({ approved: true });
    await vi.waitFor(() => expect(flushHeld).toBe(true));
    // Let the retry's settlement/finalize work reach its own flush (chained
    // behind the winner's held save) before releasing.
    await new Promise(resolve => setTimeout(resolve, 50));
    releaseFlush();
    await expect(respond1).resolves.toMatchObject({ text: 'resumed answer' });
    await expect(respond2).resolves.toMatchObject({ text: 'resumed answer' });
    off();
    vi.restoreAllMocks();

    const agentEnds = events.filter(e => e.type === 'agent_end');
    expect(agentEnds).toHaveLength(1);
    expect(agent.resumeCalls).toHaveLength(1);
    expect(
      (await storage.loadSession({ harnessName: 'default', sessionId: session.id }))?.pendingResume,
    ).toBeUndefined();
    const admission = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'double-emit-admission',
      executionGrant: grant,
    });
    expect(admission?.status).toBe('committed');
  });

  it('rejects settlement when the registered finalizer identity diverges from the admitted one', async () => {
    const db = new InMemoryDB();
    const storage1 = new InMemoryHarness({
      db,
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent1 = new MockAgent({ id: 'default' });
    agent1.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const { harness: harness1 } = setupHarness({
      agents: { default: agent1 },
      sessions: {
        storage: storage1,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session1 = await harness1.session({ resourceId: 'u1', threadId: { fresh: true } });
    const sessionId = session1.id;
    const grant = { key: 'usage-claim-finalizer-swap', generation: 1 };
    const result = await session1.message({
      content: 'needs approval',
      admissionId: 'finalizer-swap-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(result.finishReason).toBe('suspended');
    await harness1.shutdown();

    // A redeployed finalizer with a different version must not commit its
    // output under the admitted identity — the rejection is a retryable
    // pending failure so a corrected registration can still settle the grant.
    const storage2 = new InMemoryHarness({
      db,
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent2 = new MockAgent({ id: 'default' });
    agent2.enqueueRun({ finishReason: 'stop', text: 'resumed answer' });
    let v2FinalizeCalls = 0;
    const { harness: harness2 } = setupHarness({
      agents: { default: agent2 },
      sessions: {
        storage: storage2,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-21',
            finalize: async () => {
              v2FinalizeCalls += 1;
              return { projectionKind: 'chat.summary', projectionId: 'response-1', payload: {} };
            },
          },
        },
      },
    });
    try {
      const session2 = await harness2.session({ sessionId, resourceId: 'u1' });
      await expect(session2.respondToToolApproval({ approved: true })).rejects.toMatchObject({
        name: 'HarnessTerminalHandoffError:harness.terminal_pending',
      });
      expect(agent2.resumeCalls).toHaveLength(1);
      expect(v2FinalizeCalls).toBe(0);
      const admission = await storage2.loadTerminalAdmission({
        harnessName: 'default',
        sessionId,
        admissionId: 'finalizer-swap-admission',
        executionGrant: grant,
      });
      expect(admission?.status).toBe('pending');
    } finally {
      await harness2.shutdown();
    }
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
    nativeSubscription.unsubscribe();
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

  it('reconciles a committed resume winner when the parked response deadline expires', async () => {
    const db = new InMemoryDB();
    const storage1 = new InMemoryHarness({
      db,
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent1 = new MockAgent({ id: 'default' });
    agent1.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    agent1.enqueueRun({ finishReason: 'stop', text: 'resumed answer' });
    const { harness: harness1 } = setupHarness({
      agents: { default: agent1 },
      sessions: {
        storage: storage1,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session1 = await harness1.session({ resourceId: 'u1', threadId: { fresh: true } });
    const sessionId = session1.id;
    const grant = { key: 'usage-claim-stale-committed', generation: 1 };
    const result = await session1.message({
      content: 'needs approval',
      admissionId: 'stale-committed-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(result.finishReason).toBe('suspended');

    // The durable commit seals, then the pendingResume-clearing flush is lost.
    const originalCommit = storage1.commitTerminalHandoff.bind(storage1);
    let commitSealed = false;
    vi.spyOn(storage1, 'commitTerminalHandoff').mockImplementation(async input => {
      const receipt = await originalCommit(input);
      commitSealed = true;
      return receipt;
    });
    const originalSave = storage1.saveSession.bind(storage1);
    let failedOnce = false;
    vi.spyOn(storage1, 'saveSession').mockImplementation(async (record: any, opts?: any) => {
      if (commitSealed && record.pendingResume === undefined && !failedOnce) {
        failedOnce = true;
        throw new Error('pendingResume flush lost');
      }
      return originalSave(record, opts);
    });
    await expect(session1.respondToToolApproval({ approved: true })).rejects.toThrow(
      'An internal harness error occurred',
    );
    vi.restoreAllMocks();
    await harness1.shutdown();

    // Forge the resume-recovery deadline into the past so the cold sweep
    // generation picks the parked row up.
    const fixtureOwner = 'stale-committed-fixture';
    const lease = await storage1.acquireSessionLease({ sessionId, ownerId: fixtureOwner, ttlMs: 30_000 });
    const stored = await storage1.loadSession({ harnessName: 'default', sessionId });
    if (!stored?.pendingResume?.resumedAt) throw new Error('expected resumed pending fixture');
    await storage1.saveSession(
      {
        ...stored,
        ownerId: fixtureOwner,
        leaseExpiresAt: lease.expiresAt,
        pendingResume: { ...stored.pendingResume, resumeRecoveryAt: Date.now() - 1 },
      },
      { ownerId: fixtureOwner, ifVersion: lease.version },
    );
    await storage1.releaseSessionLease({ sessionId, ownerId: fixtureOwner });
    const generation = (await storage1.listDuePendingInteractions({ now: Date.now(), limit: 1 })).items[0];
    if (!generation) throw new Error('expected stale due-scan generation');

    // Cold owner: the sweep must recover the sealed winner and finish the
    // pending-clearing bookkeeping rather than fail the interaction as
    // abandoned.
    const storage2 = new InMemoryHarness({
      db,
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent2 = new MockAgent({ id: 'default' });
    const { harness: harness2 } = setupHarness({
      agents: { default: agent2 },
      sessions: {
        storage: storage2,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const events: any[] = [];
    const off = harness2.subscribe(e => events.push(e));
    try {
      (harness2 as any)._stopPendingInteractionExpirySweepLoop();
      (harness2 as any)._pendingInteractionExpirySweepRunning = true;
      await (harness2 as any)._runPendingInteractionExpiryGeneration(storage2, generation);
      (harness2 as any)._pendingInteractionExpirySweepRunning = false;

      // The sealed winner is recovered — a stale classification would emit
      // `resume_failed` and tear down the pending instead.
      expect(events.filter(e => e.type === 'resume_failed')).toHaveLength(0);
      const after = await storage2.loadSession({ harnessName: 'default', sessionId });
      expect(after?.pendingResume).toBeUndefined();
      const admission = await storage2.loadTerminalAdmission({
        harnessName: 'default',
        sessionId,
        admissionId: 'stale-committed-admission',
        executionGrant: grant,
      });
      expect(admission?.status).toBe('committed');
      await expect(
        storage2.loadMessageResultEvidence({
          harnessName: 'default',
          sessionId,
          resourceId: 'u1',
          threadId: after!.threadId,
          signalId: admission!.signalId,
        }),
      ).resolves.toMatchObject({ status: 'completed' });
      expect(agent2.streamCalls).toHaveLength(0);
      expect(agent2.resumeCalls).toHaveLength(0);
    } finally {
      off();
      await harness2.shutdown();
    }
  });

  it('does not double-count resumed usage when the pending-clearing flush is lost across a restart', async () => {
    const db = new InMemoryDB();
    const storage1 = new InMemoryHarness({
      db,
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent1 = new MockAgent({ id: 'default' });
    agent1.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });
    // A resumed stream restores its prior counter — FullOutput.totalUsage is
    // cumulative across the suspend boundary.
    agent1.enqueueRun({
      finishReason: 'stop',
      text: 'resumed answer',
      usage: { inputTokens: 14, outputTokens: 9, totalTokens: 23 },
      totalUsage: { inputTokens: 14, outputTokens: 9, totalTokens: 23 },
    });
    const { harness: harness1 } = setupHarness({
      agents: { default: agent1 },
      sessions: {
        storage: storage1,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session1 = await harness1.session({ resourceId: 'u1', threadId: { fresh: true } });
    const sessionId = session1.id;
    const grant = { key: 'usage-claim-restart-usage', generation: 1 };
    const result = await session1.message({
      content: 'needs approval',
      admissionId: 'restart-usage-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(result.finishReason).toBe('suspended');
    const parkedBaseline = (await storage1.loadSession({ harnessName: 'default', sessionId }))?.pendingResume
      ?.accountedTokenUsage;
    expect(parkedBaseline?.totalTokens).toBe(15);

    const originalCommit = storage1.commitTerminalHandoff.bind(storage1);
    let commitSealed = false;
    vi.spyOn(storage1, 'commitTerminalHandoff').mockImplementation(async input => {
      const receipt = await originalCommit(input);
      commitSealed = true;
      return receipt;
    });
    const originalSave = storage1.saveSession.bind(storage1);
    let failedOnce = false;
    vi.spyOn(storage1, 'saveSession').mockImplementation(async (record: any, opts?: any) => {
      if (commitSealed && record.pendingResume === undefined && !failedOnce) {
        failedOnce = true;
        throw new Error('pendingResume flush lost');
      }
      return originalSave(record, opts);
    });
    await expect(session1.respondToToolApproval({ approved: true })).rejects.toThrow(
      'An internal harness error occurred',
    );
    vi.restoreAllMocks();

    // The next durable write (here, the shutdown token-usage persist) must fold
    // the advanced resume baseline into the still-parked pending row — a stale
    // durable baseline makes a cold settlement retry re-apply the same delta.
    await harness1.shutdown();
    const parked = (await storage1.loadSession({ harnessName: 'default', sessionId }))?.pendingResume;
    expect(parked?.accountedTokenUsage?.totalTokens).toBe(23);

    const storage2 = new InMemoryHarness({
      db,
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent2 = new MockAgent({ id: 'default' });
    const { harness: harness2 } = setupHarness({
      agents: { default: agent2 },
      sessions: {
        storage: storage2,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    try {
      const session2 = await harness2.session({ sessionId, resourceId: 'u1' });
      const retried = await session2.respondToToolApproval({ approved: true });
      expect(retried.text).toBe('resumed answer');
      expect(agent2.resumeCalls).toHaveLength(0);
      const after = await storage2.loadSession({ harnessName: 'default', sessionId });
      expect(after?.pendingResume).toBeUndefined();
      expect(after?.tokenUsage?.totalTokens).toBe(23);
    } finally {
      await harness2.shutdown();
    }
  });

  it('fails closed on a live pending grant when the resumed session has no registered finalizer', async () => {
    const db = new InMemoryDB();
    const storage1 = new InMemoryHarness({
      db,
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent1 = new MockAgent({ id: 'default' });
    agent1.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const { harness: harness1 } = setupHarness({
      agents: { default: agent1 },
      sessions: {
        storage: storage1,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session1 = await harness1.session({ resourceId: 'u1', threadId: { fresh: true } });
    const sessionId = session1.id;
    const grant = { key: 'usage-claim-no-finalizer', generation: 1 };
    const result = await session1.message({
      content: 'needs approval',
      admissionId: 'no-finalizer-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(result.finishReason).toBe('suspended');
    await harness1.shutdown();

    // A reopened session without a registered finalizer can still read durable
    // terminal state — but a live pending grant can never settle through it, so
    // the resume must fail closed instead of dispatching the provider.
    const storage2 = new InMemoryHarness({
      db,
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent2 = new MockAgent({ id: 'default' });
    const { harness: harness2 } = setupHarness({
      agents: { default: agent2 },
      sessions: { storage: storage2 },
    });
    try {
      const session2 = await harness2.session({ sessionId, resourceId: 'u1' });
      await expect(session2.respondToToolApproval({ approved: true })).rejects.toMatchObject({
        name: 'HarnessTerminalHandoffError:harness.terminal_invalid',
      });
      expect(agent2.resumeCalls).toHaveLength(0);
      expect(agent2.streamCalls).toHaveLength(0);
      const admission = await storage2.loadTerminalAdmission({
        harnessName: 'default',
        sessionId,
        admissionId: 'no-finalizer-admission',
        executionGrant: grant,
      });
      expect(admission?.status).toBe('pending');
      expect((await storage2.loadSession({ harnessName: 'default', sessionId }))?.pendingResume).toBeDefined();
    } finally {
      await harness2.shutdown();
    }
  });

  it('snapshots the terminal admission seed before the first yield', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-seed-snapshot', generation: 1 };

    let releaseAdmit!: () => void;
    let admitEntered!: () => void;
    const admitGate = new Promise<void>(resolve => (releaseAdmit = resolve));
    const admitStarted = new Promise<void>(resolve => (admitEntered = resolve));
    const originalAdmit = storage.admitTerminalHandoff.bind(storage);
    vi.spyOn(storage, 'admitTerminalHandoff').mockImplementation(async input => {
      admitEntered();
      await admitGate;
      return originalAdmit(input);
    });

    const seed: Record<string, unknown> = { collector: { responseId: 'r1' }, schemaVersion: 2 };
    const pending = session.message({
      content: 'go',
      admissionId: 'seed-snapshot-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: seed,
    });
    await admitStarted;
    // The caller mutates its object while admission work is awaiting storage —
    // the hashed and persisted seed must both be the pre-mutation snapshot.
    seed.injected = 'mutated-after-dispatch';
    releaseAdmit();
    await pending;

    const admission = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'seed-snapshot-admission',
      executionGrant: grant,
    });
    expect(admission?.status).toBe('committed');
    expect(admission?.seed).toEqual({ collector: { responseId: 'r1' }, schemaVersion: 2 });
  });

  it('surfaces a cancellation tombstone to a duplicate waiting on durable evidence', async () => {
    const db = new InMemoryDB();
    const storage1 = new InMemoryHarness({
      db,
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent1 = new MockAgent({ id: 'default' });
    agent1.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const { harness: harness1 } = setupHarness({
      agents: { default: agent1 },
      sessions: {
        storage: storage1,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session1 = await harness1.session({ resourceId: 'u1', threadId: { fresh: true } });
    const sessionId = session1.id;
    const grant = { key: 'usage-claim-wait-cancelled', generation: 1 };
    const opts = {
      content: 'needs approval',
      admissionId: 'wait-cancelled-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    } as const;
    const result = await session1.message({ ...opts });
    expect(result.finishReason).toBe('suspended');
    const admitted = await storage1.loadTerminalAdmission({
      harnessName: 'default',
      sessionId,
      admissionId: 'wait-cancelled-admission',
      executionGrant: grant,
    });
    expect(admitted?.status).toBe('pending');
    await harness1.shutdown();

    // Cold owner: no cached run, no live stream — the identical retry lands on
    // the durable-evidence wait loop. Its entry probe still sees the admission
    // pending; the cancel lands immediately after, so the wait must surface the
    // tombstone on its next pass instead of expiring into an unrelated liveness
    // error.
    const storage2 = new InMemoryHarness({
      db,
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent2 = new MockAgent({ id: 'default' });
    const { harness: harness2 } = setupHarness({
      agents: { default: agent2 },
      sessions: {
        storage: storage2,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    try {
      const session2 = await harness2.session({ sessionId, resourceId: 'u1' });
      const originalLoad = storage2.loadTerminalAdmission.bind(storage2);
      let probed = false;
      vi.spyOn(storage2, 'loadTerminalAdmission').mockImplementation(async input => {
        const admission = await originalLoad(input);
        if (!probed && admission?.status === 'pending') {
          probed = true;
          await storage2.cancelTerminalHandoff({
            harnessName: admission.harnessName,
            sessionId: admission.sessionId,
            sessionIncarnation: admission.sessionIncarnation,
            admissionId: admission.admissionId,
            admissionHash: admission.admissionHash,
            executionGrant: admission.executionGrant,
            reason: { code: 'harness.terminal_cancelled', message: 'revoked mid-wait' },
          });
        }
        return admission;
      });
      const failures: Error[] = [];
      const second = session2.message({ ...opts, onTerminalCommitError: err => failures.push(err) });
      void second.catch(() => {});
      await expect(settleWithinTicks(second, 20)).rejects.toMatchObject({
        name: 'HarnessTerminalHandoffError:harness.terminal_cancelled',
      });
      expect(failures).toHaveLength(1);
      expect(failures[0]!.name).toBe('HarnessTerminalHandoffError:harness.terminal_cancelled');
      expect(agent2.streamCalls).toHaveLength(0);
    } finally {
      await harness2.shutdown();
    }
  });

  it('rejects a re-admission whose duplicate envelope carries a fenced stored row', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-fenced-duplicate', generation: 1 };
    const opts = {
      content: 'go',
      admissionId: 'fenced-duplicate-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    } as const;

    // Strand the first attempt: the terminal admission lands, then the durable
    // dispatch-marker write is lost — so a retry provably never dispatched.
    const originalCas = storage.compareAndSwapSignalDispatch.bind(storage);
    let markerLost = false;
    vi.spyOn(storage, 'compareAndSwapSignalDispatch').mockImplementation(async input => {
      if (!markerLost && input.operationKind === 'message' && input.next.state === 'dispatching') {
        markerLost = true;
        throw new Error('dispatch marker write lost');
      }
      return originalCas(input);
    });
    await expect(session.message({ ...opts })).rejects.toThrow('An internal harness error occurred');
    vi.restoreAllMocks();
    const admitted = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'fenced-duplicate-admission',
      executionGrant: grant,
    });
    expect(admitted?.status).toBe('pending');

    // Fencing lands between the retry's pending probe and its re-admission: the
    // storage returns a duplicate envelope carrying the dead row, and the
    // caller must surface the fence rather than dispatching the provider.
    vi.spyOn(storage, 'admitTerminalHandoff').mockImplementation(async () => ({
      status: 'duplicate',
      admission: { ...admitted!, status: 'fenced' },
    }));
    await expect(session.message({ ...opts })).rejects.toMatchObject({
      name: 'HarnessTerminalHandoffError:harness.terminal_fenced',
    });
    expect(agent.streamCalls).toHaveLength(0);
  });

  it('drains retained terminal observers when pending teardown finds the admission already cancelled', async () => {
    vi.useFakeTimers();
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        pendingInteractionTtlMs: 1_000,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    try {
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      const grant = { key: 'usage-claim-teardown-drain', generation: 1 };
      const failures: Error[] = [];
      const result = await session.message({
        content: 'needs approval',
        admissionId: 'teardown-drain-admission',
        executionAuthorityGrant: grant,
        terminalAdmissionSeed: { v: 1 },
        onTerminalCommitError: err => failures.push(err),
      });
      expect(result.finishReason).toBe('suspended');
      const admitted = await storage.loadTerminalAdmission({
        harnessName: 'default',
        sessionId: session.id,
        admissionId: 'teardown-drain-admission',
        executionGrant: grant,
      });
      expect(admitted?.status).toBe('pending');

      // An external teardown cancels the grant while the parked interaction
      // survives; the pending's own expiry then must hand the retained
      // observers the cancelled outcome — not the generic expiry error.
      await storage.cancelTerminalHandoff({
        harnessName: admitted!.harnessName,
        sessionId: admitted!.sessionId,
        sessionIncarnation: admitted!.sessionIncarnation,
        admissionId: admitted!.admissionId,
        admissionHash: admitted!.admissionHash,
        executionGrant: admitted!.executionGrant,
        reason: { code: 'harness.terminal_cancelled', message: 'external teardown' },
      });

      // Move past the pending interaction deadline and drive the due-scan
      // generation on the owning harness — it routes to the live session whose
      // retained observers are keyed to this run.
      vi.setSystemTime(Date.now() + 2_000);
      const generation = (await storage.listDuePendingInteractions({ now: Date.now(), limit: 1 })).items[0];
      if (!generation) throw new Error('expected stale due-scan generation');
      (harness as any)._stopPendingInteractionExpirySweepLoop();
      (harness as any)._pendingInteractionExpirySweepRunning = true;
      await (harness as any)._runPendingInteractionExpiryGeneration(storage, generation);
      (harness as any)._pendingInteractionExpirySweepRunning = false;

      expect(failures).toHaveLength(1);
      expect(failures[0]!.name).toBe('HarnessTerminalHandoffError:harness.terminal_cancelled');
      const after = await storage.loadSession({ harnessName: 'default', sessionId: session.id });
      expect(after?.pendingResume).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not clear a newer pendingResume when a stale settlement retry finishes late', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    agent.enqueueRun({ finishReason: 'stop', text: 'resumed answer' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-2', toolName: 'shell', args: { cmd: 'pwd' } },
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-stale-flush', generation: 1 };
    const first = await session.message({
      content: 'needs approval',
      admissionId: 'stale-flush-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(first.finishReason).toBe('suspended');

    // Hold the winner inside its pendingResume-clearing flush AFTER the
    // durable commit seals, and hold the settlement retry at its by-run
    // admission probe — that probe only observes 'committed' once the winner
    // has sealed, so gating on it cannot catch the winner's own calls.
    let releaseWinnerFlush!: () => void;
    const winnerFlushGate = new Promise<void>(resolve => (releaseWinnerFlush = resolve));
    let releaseProbe!: () => void;
    const probeGate = new Promise<void>(resolve => (releaseProbe = resolve));
    let commitSealed = false;
    let winnerFlushHeld = false;
    let probeHeld = false;
    const originalCommit = storage.commitTerminalHandoff.bind(storage);
    vi.spyOn(storage, 'commitTerminalHandoff').mockImplementation(async input => {
      const receipt = await originalCommit(input);
      if (receipt.status === 'committed') commitSealed = true;
      return receipt;
    });
    const originalSave = storage.saveSession.bind(storage);
    vi.spyOn(storage, 'saveSession').mockImplementation(async (record: any, opts?: any) => {
      if (commitSealed && record.pendingResume === undefined && !winnerFlushHeld) {
        winnerFlushHeld = true;
        await winnerFlushGate;
      }
      return originalSave(record, opts);
    });
    const originalProbe = storage.loadTerminalAdmissionByRun.bind(storage);
    vi.spyOn(storage, 'loadTerminalAdmissionByRun').mockImplementation(async input => {
      const admission = await originalProbe(input);
      if (admission?.status === 'committed' && !probeHeld) {
        probeHeld = true;
        await probeGate;
      }
      return admission;
    });

    const respond1 = session.respondToToolApproval({ approved: true });
    await vi.waitFor(() => expect(commitSealed).toBe(true));
    const respond2 = session.respondToToolApproval({ approved: true });
    await vi.waitFor(() => expect(probeHeld).toBe(true));
    await vi.waitFor(() => expect(winnerFlushHeld).toBe(true));

    // Release the winner so gen-A's pendingResume clears, then park a NEWER
    // suspension before the stale retry resumes past its probe. The retry's
    // finalize flush must leave the newer generation untouched.
    releaseWinnerFlush();
    await expect(respond1).resolves.toMatchObject({ text: 'resumed answer' });
    const second = await session.message({ content: 'suspend again' });
    expect(second.finishReason).toBe('suspended');
    expect(session.getRecord().pendingResume?.toolCallId).toBe('tc-2');

    releaseProbe();
    await expect(respond2).resolves.toMatchObject({ text: 'resumed answer' });
    expect(session.getRecord().pendingResume?.toolCallId).toBe('tc-2');
    expect(
      (await storage.loadSession({ harnessName: 'default', sessionId: session.id }))?.pendingResume?.toolCallId,
    ).toBe('tc-2');
  });

  it('cancels the deferred terminal admission when a resumed re-suspension is undeliverable', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-undeliverable-resuspend', generation: 1 };
    const failures: Error[] = [];
    const result = await session.message({
      content: 'needs approval',
      admissionId: 'undeliverable-resuspend-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
      onTerminalCommitError: err => failures.push(err),
    });
    expect(result.finishReason).toBe('suspended');
    const admission = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'undeliverable-resuspend-admission',
      executionGrant: grant,
    });
    expect(admission?.status).toBe('pending');

    // Stamp `resumedAt` exactly as the resume admission CAS does, then drive
    // the undeliverable-resuspension teardown directly: the thread runtime has
    // already discarded the segment, so the parked interaction is removed —
    // the deferred grant it was bound to must be cancelled with it or it
    // would strand 'pending' forever with no recoverable interaction.
    const resumedAt = Date.now();
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingResume: { ...prev.pendingResume, resumedAt },
    }));
    const stamped = session.getRecord().pendingResume!;
    const terminalized = await (session as any)._terminalizeUndeliverableResuspension({
      pending: stamped,
      resumedAt,
      previousModeId: session.getRecord().modeId,
      full: { finishReason: 'suspended', runId: stamped.runId } as any,
      error: new AgentThreadOutputDrainError('terminal-publish-failed', 'publication lost'),
    });
    expect(terminalized).toBe(true);
    expect(session.getRecord().pendingResume).toBeUndefined();

    const after = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'undeliverable-resuspend-admission',
      executionGrant: grant,
    });
    expect(after?.status).toBe('cancelled');
    expect(failures).toHaveLength(1);
    expect(failures[0]!.name).toBe('HarnessTerminalHandoffError:harness.terminal_cancelled');
  });

  it('marks the responding inbox receipt applied when the committed winner is recovered without its responseId', async () => {
    const db = new InMemoryDB();
    const storage1 = new InMemoryHarness({
      db,
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent1 = new MockAgent({ id: 'default' });
    agent1.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    agent1.enqueueRun({ finishReason: 'stop', text: 'resumed answer' });
    const { harness: harness1 } = setupHarness({
      agents: { default: agent1 },
      sessions: {
        storage: storage1,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session1 = await harness1.session({ resourceId: 'u1', threadId: { fresh: true } });
    const sessionId = session1.id;
    const grant = { key: 'usage-claim-receipt-recovery', generation: 1 };
    const result = await session1.message({
      content: 'needs approval',
      admissionId: 'receipt-recovery-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(result.finishReason).toBe('suspended');
    const pending = session1.getRecord().pendingResume!;

    // The durable commit seals, then the pendingResume-clearing flush is lost —
    // the admitted inbox receipt stays 'accepted'.
    const originalCommit = storage1.commitTerminalHandoff.bind(storage1);
    let commitSealed = false;
    vi.spyOn(storage1, 'commitTerminalHandoff').mockImplementation(async input => {
      const receipt = await originalCommit(input);
      commitSealed = true;
      return receipt;
    });
    const originalSave = storage1.saveSession.bind(storage1);
    let failedOnce = false;
    vi.spyOn(storage1, 'saveSession').mockImplementation(async (record: any, opts?: any) => {
      if (commitSealed && record.pendingResume === undefined && !failedOnce) {
        failedOnce = true;
        throw new Error('pendingResume flush lost');
      }
      return originalSave(record, opts);
    });
    await expect(
      session1.respondToToolApproval({
        itemId: pending.itemId!,
        runId: pending.runId,
        toolCallId: pending.toolCallId,
        pendingRequestedAt: pending.requestedAt,
        responseId: 'committed-winner-receipt',
        approved: true,
      }),
    ).rejects.toThrow('An internal harness error occurred');
    vi.restoreAllMocks();
    await harness1.shutdown();
    const stranded = await storage1.loadSession({ harnessName: 'default', sessionId });
    expect(stranded?.inboxResponseReceipts?.['committed-winner-receipt']?.status).toBe('accepted');

    // Forge the resume-recovery deadline into the past so the cold sweep
    // generation picks the parked row up.
    const fixtureOwner = 'receipt-recovery-fixture';
    const lease = await storage1.acquireSessionLease({ sessionId, ownerId: fixtureOwner, ttlMs: 30_000 });
    const stored = await storage1.loadSession({ harnessName: 'default', sessionId });
    if (!stored?.pendingResume?.resumedAt) throw new Error('expected resumed pending fixture');
    await storage1.saveSession(
      {
        ...stored,
        ownerId: fixtureOwner,
        leaseExpiresAt: lease.expiresAt,
        pendingResume: { ...stored.pendingResume, resumeRecoveryAt: Date.now() - 1 },
      },
      { ownerId: fixtureOwner, ifVersion: lease.version },
    );
    await storage1.releaseSessionLease({ sessionId, ownerId: fixtureOwner });
    const generation = (await storage1.listDuePendingInteractions({ now: Date.now(), limit: 1 })).items[0];
    if (!generation) throw new Error('expected stale due-scan generation');

    // Cold owner: the sweep recovers the sealed winner. The recovered path
    // has no `responseId`, so the receipt admitted by the crashed respond must
    // be matched to the pending generation and marked applied — a retry of
    // the same responseId must not read a nonterminal 'accepted' forever.
    const storage2 = new InMemoryHarness({
      db,
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent2 = new MockAgent({ id: 'default' });
    const { harness: harness2 } = setupHarness({
      agents: { default: agent2 },
      sessions: {
        storage: storage2,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    try {
      (harness2 as any)._stopPendingInteractionExpirySweepLoop();
      (harness2 as any)._pendingInteractionExpirySweepRunning = true;
      await (harness2 as any)._runPendingInteractionExpiryGeneration(storage2, generation);
      (harness2 as any)._pendingInteractionExpirySweepRunning = false;

      const after = await storage2.loadSession({ harnessName: 'default', sessionId });
      expect(after?.pendingResume).toBeUndefined();
      const receipt = after?.inboxResponseReceipts?.['committed-winner-receipt'];
      expect(receipt?.status).toBe('applied');
      expect(receipt?.result).toMatchObject({ text: 'resumed answer' });
      expect(agent2.resumeCalls).toHaveLength(0);
    } finally {
      await harness2.shutdown();
    }
  });

  it('drains adopted-stream terminal observers when run completion rejects', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    // Adopt a live run, then reject the shared completion barrier: the
    // retained terminal observers must see the indeterminate outcome rather
    // than wait forever on a collector failure that never reached the
    // commit helper.
    const output = buildFakeOutput({ runId: 'adopted-run', fullOutput: agent.fullOutput });
    vi.spyOn(agent, 'getRunOutput').mockReturnValue(output);
    let rejectCompletion!: (err: unknown) => void;
    const completionPromise = new Promise<unknown>((_, reject) => {
      rejectCompletion = reject;
    });
    (session as any)._runCompletionPromises.set('adopted-run', {
      promise: completionPromise,
      resolve: vi.fn(),
      reject: rejectCompletion,
    });
    const failures: Error[] = [];
    const adopted = await (session as any)._returnDuplicateMessageResult(
      {
        status: 'pending',
        signalId: 'adopted-signal',
        runId: 'adopted-run',
        admissionId: 'adopted-admission',
        admissionHash: 'adopted-hash',
      },
      {
        stream: true,
        executionAuthorityGrant: { key: 'usage-claim-adopted', generation: 1 },
        onTerminalCommitError: (err: Error) => failures.push(err),
      },
    );
    expect(adopted).toBe(output);

    rejectCompletion(new Error('collector died'));
    await vi.waitFor(() => expect(failures).toHaveLength(1));
    expect(failures[0]!.name).toBe('HarnessTerminalHandoffError:harness.terminal_pending');
  });

  it('commits the deferred admission when a terminal resume joins the suspended attempt', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    agent.enqueueRun({ finishReason: 'stop', text: 'resumed answer' });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-shared-deferral', generation: 1 };

    // Hold the suspended run's commit inside its durable admission probe so
    // the resume's settlement joins the shared in-flight attempt while it is
    // still parked in `_terminalCommitsByRunId`.
    let admissionLoads = 0;
    let releaseFirstAdmissionLoad!: () => void;
    const firstAdmissionLoadGate = new Promise<void>(resolve => (releaseFirstAdmissionLoad = resolve));
    const originalLoad = storage.loadTerminalAdmission.bind(storage);
    vi.spyOn(storage, 'loadTerminalAdmission').mockImplementation(async (input: any) => {
      admissionLoads += 1;
      if (admissionLoads === 1) await firstAdmissionLoadGate;
      return originalLoad(input);
    });
    let byRunLoads = 0;
    const originalByRun = storage.loadTerminalAdmissionByRun.bind(storage);
    vi.spyOn(storage, 'loadTerminalAdmissionByRun').mockImplementation(async (input: any) => {
      const admission = await originalByRun(input);
      byRunLoads += 1;
      return admission;
    });

    const messagePromise = session.message({
      content: 'needs approval',
      admissionId: 'shared-deferral-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    await vi.waitFor(() => expect(admissionLoads).toBe(1));

    const respondPromise = session.respondToToolApproval({ approved: true });
    // The resume's settle probes the admission by run (the first by-run load
    // is the pre-dispatch refuse check) and then joins the held commit.
    await vi.waitFor(() => expect(byRunLoads).toBeGreaterThanOrEqual(2));
    await new Promise(resolve => setTimeout(resolve, 0));
    releaseFirstAdmissionLoad();

    await expect(respondPromise).resolves.toMatchObject({ text: 'resumed answer' });
    await expect(messagePromise).resolves.toMatchObject({ finishReason: 'suspended' });

    // The joined caller's output was terminal — sharing the suspended
    // attempt's deferral would strand the grant pending forever, so the join
    // must re-drive settlement once the in-flight attempt clears.
    const admission = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'shared-deferral-admission',
      executionGrant: grant,
    });
    expect(admission?.status).toBe('committed');
    expect(session.getRecord().pendingResume).toBeUndefined();
  });

  it('keeps the pending recovery marker when terminalized-admission cancellation fails', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-cancel-first', generation: 1 };
    const result = await session.message({
      content: 'needs approval',
      admissionId: 'cancel-first-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(result.finishReason).toBe('suspended');

    const resumedAt = Date.now();
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingResume: { ...prev.pendingResume, resumedAt },
    }));
    const stamped = session.getRecord().pendingResume!;

    // If cancellation fails, the fenced generation must stay parked as the
    // discoverable recovery marker — clearing it first would strand the
    // still-pending admission with no path that ever retries the cancel.
    const originalCancel = storage.cancelTerminalHandoff.bind(storage);
    let cancelCalls = 0;
    vi.spyOn(storage, 'cancelTerminalHandoff').mockImplementation(async (input: any) => {
      cancelCalls += 1;
      if (cancelCalls === 1) throw new Error('cancel write lost');
      return originalCancel(input);
    });
    // The raw storage error is wrapped in the typed indeterminate-outcome
    // error — the tombstone may or may not have landed — and the same pending
    // failure is drained to retained observers.
    await expect(
      (session as any)._terminalizeUndeliverableResuspension({
        pending: stamped,
        resumedAt,
        previousModeId: session.getRecord().modeId,
        full: { finishReason: 'suspended', runId: stamped.runId } as any,
        error: new AgentThreadOutputDrainError('terminal-publish-failed', 'publication lost'),
      }),
    ).rejects.toThrow('Native terminal finalization is indeterminate and requires reconciliation');
    expect(session.getRecord().pendingResume?.toolCallId).toBe('tc-1');
    expect(
      (
        await storage.loadTerminalAdmission({
          harnessName: 'default',
          sessionId: session.id,
          admissionId: 'cancel-first-admission',
          executionGrant: grant,
        })
      )?.status,
    ).toBe('pending');

    // The retry is idempotent: the cancel already left durable state, and the
    // still-parked generation re-matches the teardown updater.
    const terminalized = await (session as any)._terminalizeUndeliverableResuspension({
      pending: session.getRecord().pendingResume!,
      resumedAt,
      previousModeId: session.getRecord().modeId,
      full: { finishReason: 'suspended', runId: stamped.runId } as any,
      error: new AgentThreadOutputDrainError('terminal-publish-failed', 'publication lost'),
    });
    expect(terminalized).toBe(true);
    expect(session.getRecord().pendingResume).toBeUndefined();
    expect(
      (
        await storage.loadTerminalAdmission({
          harnessName: 'default',
          sessionId: session.id,
          admissionId: 'cancel-first-admission',
          executionGrant: grant,
        })
      )?.status,
    ).toBe('cancelled');
  });

  it('cancels the deferred admission when the suspension exceeds the record size budget', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-big', toolName: 'shell', args: { cmd: 'x'.repeat(1_000_000) } },
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-budget-drop', generation: 1 };
    const failures: Error[] = [];
    const result = await session.message({
      content: 'needs approval',
      admissionId: 'budget-drop-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
      onTerminalCommitError: err => failures.push(err),
    });
    expect(result.finishReason).toBe('suspended');

    // The ~1MB suspend payload overflows the 900KB session-record budget, so
    // the park flush expires the interaction instead of persisting it. With no
    // resumable interaction left to settle the grant, the deferred admission
    // must be cancelled — deferring would strand it pending forever.
    await vi.waitFor(() => {
      expect(session.getRecord().pendingResume).toBeUndefined();
    });
    const admission = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'budget-drop-admission',
      executionGrant: grant,
    });
    expect(admission?.status).toBe('cancelled');
    expect(failures.some(err => err.name === 'HarnessTerminalHandoffError:harness.terminal_cancelled')).toBe(true);
  });

  it('cancels the deferred admission when a resumed re-suspension exceeds the record budget', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-big', toolName: 'shell', args: { cmd: 'x'.repeat(1_000_000) } },
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-resume-budget-drop', generation: 1 };
    const first = await session.message({
      content: 'needs approval',
      admissionId: 'resume-budget-drop-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(first.finishReason).toBe('suspended');
    expect(
      (
        await storage.loadTerminalAdmission({
          harnessName: 'default',
          sessionId: session.id,
          admissionId: 'resume-budget-drop-admission',
          executionGrant: grant,
        })
      )?.status,
    ).toBe('pending');

    const resumed = await session.respondToToolApproval({ approved: true });
    expect(resumed.finishReason).toBe('suspended');

    // Same budget expiry on the re-park: the deferred admission cannot strand
    // pending behind a suspension the record could not retain.
    expect(session.getRecord().pendingResume).toBeUndefined();
    expect(
      (
        await storage.loadTerminalAdmission({
          harnessName: 'default',
          sessionId: session.id,
          admissionId: 'resume-budget-drop-admission',
          executionGrant: grant,
        })
      )?.status,
    ).toBe('cancelled');
  });

  it('does not overwrite a newer switchMode when a stale settlement retry finishes late', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-P', toolName: 'submit_plan', args: { title: 't', plan: 'p' } },
    });
    agent.enqueueRun({ finishReason: 'stop', text: 'resumed answer' });
    const { harness } = setupHarness({
      agents: { default: agent },
      modes: [
        { id: 'planner', agentId: 'default', transitionsTo: 'builder' },
        { id: 'builder', agentId: 'default' },
      ],
      defaultModeId: 'planner',
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-mode-fence', generation: 1 };
    const first = await session.message({
      content: 'plan',
      admissionId: 'mode-fence-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(first.finishReason).toBe('suspended');
    const pending = session.getRecord().pendingResume!;
    expect(pending.kind).toBe('plan-approval');

    // The winner completes the plan approval: admission committed, pending
    // cleared, mode flipped to 'builder'.
    await expect(session.respondToPlanApproval({ approved: true })).resolves.toMatchObject({
      text: 'resumed answer',
    });
    expect(session.getCurrentMode().id).toBe('builder');
    expect(session.getRecord().pendingResume).toBeUndefined();

    // The user then switches back — a settlement retry that was paused in its
    // admission probe must not resurrect 'builder' now that its pending
    // generation is gone.
    await session.switchMode({ mode: 'planner' });
    const full = (session as any)._completedRuns.get(pending.runId)!.full;
    await (session as any)._finalizeResumedTurnOutcome(pending, full, {
      previousModeId: 'planner',
      resumeModeId: 'planner',
      modeFlipTarget: 'builder',
      deletedTurnWaiter: new Promise(() => {}),
    });
    expect(session.getCurrentMode().id).toBe('planner');
    expect((await storage.loadSession({ harnessName: 'default', sessionId: session.id }))?.modeId).toBe('planner');
  });

  it('judges a settled turn exactly once across concurrent settlement retries', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    agent.enqueueRun({ finishReason: 'stop', text: 'resumed answer' });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-judge-dedup', generation: 1 };
    const first = await session.message({
      content: 'needs approval',
      admissionId: 'judge-dedup-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(first.finishReason).toBe('suspended');

    let releaseWinnerFlush!: () => void;
    const winnerFlushGate = new Promise<void>(resolve => (releaseWinnerFlush = resolve));
    let releaseProbe!: () => void;
    const probeGate = new Promise<void>(resolve => (releaseProbe = resolve));
    let commitSealed = false;
    let winnerFlushHeld = false;
    let probeHeld = false;
    const originalCommit = storage.commitTerminalHandoff.bind(storage);
    vi.spyOn(storage, 'commitTerminalHandoff').mockImplementation(async input => {
      const receipt = await originalCommit(input);
      if (receipt.status === 'committed') commitSealed = true;
      return receipt;
    });
    const originalSave = storage.saveSession.bind(storage);
    vi.spyOn(storage, 'saveSession').mockImplementation(async (record: any, opts?: any) => {
      if (commitSealed && record.pendingResume === undefined && !winnerFlushHeld) {
        winnerFlushHeld = true;
        await winnerFlushGate;
      }
      return originalSave(record, opts);
    });
    const originalProbe = storage.loadTerminalAdmissionByRun.bind(storage);
    vi.spyOn(storage, 'loadTerminalAdmissionByRun').mockImplementation(async input => {
      const admission = await originalProbe(input);
      if (admission?.status === 'committed' && !probeHeld) {
        probeHeld = true;
        await probeGate;
      }
      return admission;
    });

    // The judge runs once per settled run — a settlement retry re-entering
    // `_finalizeResumedTurnOutcome` must not invoke it again or a 'continue'
    // verdict would double-spend goal budget and enqueue a second
    // continuation.
    const judgeSpy = vi.spyOn(session as any, '_runGoalJudge');
    const respond1 = session.respondToToolApproval({ approved: true });
    await vi.waitFor(() => expect(commitSealed).toBe(true));
    const respond2 = session.respondToToolApproval({ approved: true });
    await vi.waitFor(() => expect(probeHeld).toBe(true));
    await vi.waitFor(() => expect(winnerFlushHeld).toBe(true));

    releaseWinnerFlush();
    await expect(respond1).resolves.toMatchObject({ text: 'resumed answer' });
    releaseProbe();
    await expect(respond2).resolves.toMatchObject({ text: 'resumed answer' });
    expect(judgeSpy).toHaveBeenCalledTimes(1);
  });

  it('does not restore a cached suspension over a newer parked pending generation', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-2', toolName: 'shell', args: { cmd: 'ls -la' } },
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-stale-restore', generation: 1 };
    const first = await session.message({
      content: 'needs approval',
      admissionId: 'stale-restore-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(first.finishReason).toBe('suspended');
    expect(session.getRecord().pendingResume?.toolCallId).toBe('tc-1');

    // A duplicate message reads the cached suspended output and checks
    // `pendingResume` before awaiting the admission probe. Hold that probe so
    // a resume can park a NEWER suspension in the gap — the restore must then
    // lose, not overwrite the live generation.
    let byRunCalls = 0;
    let releaseProbe!: () => void;
    const probeGate = new Promise<void>(resolve => (releaseProbe = resolve));
    const originalByRun = storage.loadTerminalAdmissionByRun.bind(storage);
    vi.spyOn(storage, 'loadTerminalAdmissionByRun').mockImplementation(async (input: any) => {
      byRunCalls += 1;
      if (byRunCalls === 1) await probeGate;
      return originalByRun(input);
    });

    const duplicate = session.message({
      content: 'needs approval',
      admissionId: 'stale-restore-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    await vi.waitFor(() => expect(byRunCalls).toBe(1));

    // The resume executes, re-suspends on tc-2, and parks the newer pending.
    const resumed = await session.respondToToolApproval({ approved: true });
    expect(resumed.finishReason).toBe('suspended');
    expect(session.getRecord().pendingResume?.toolCallId).toBe('tc-2');

    // Releasing the duplicate's probe must not restore tc-1 over tc-2.
    releaseProbe();
    await expect(duplicate).resolves.toMatchObject({ finishReason: 'suspended' });
    expect(session.getRecord().pendingResume?.toolCallId).toBe('tc-2');
  });

  it('notifies a terminal caller once when it re-drives a joined deferred commit', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    agent.enqueueRun({ finishReason: 'stop', text: 'resumed answer' });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-joined-once', generation: 1 };

    // Hold the suspended run's commit inside its durable admission probe so a
    // resume AND a duplicate message can both join the parked attempt.
    let admissionLoads = 0;
    let releaseFirstAdmissionLoad!: () => void;
    const firstAdmissionLoadGate = new Promise<void>(resolve => (releaseFirstAdmissionLoad = resolve));
    const originalLoad = storage.loadTerminalAdmission.bind(storage);
    vi.spyOn(storage, 'loadTerminalAdmission').mockImplementation(async (input: any) => {
      admissionLoads += 1;
      if (admissionLoads === 1) await firstAdmissionLoadGate;
      return originalLoad(input);
    });
    const commitSpy = vi.spyOn(session as any, '_commitTerminalHandoff');
    const originalReceipts: unknown[] = [];
    const message1 = session.message({
      content: 'needs approval',
      admissionId: 'joined-once-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
      onTerminalCommit: receipt => originalReceipts.push(receipt),
    });
    await vi.waitFor(() => expect(admissionLoads).toBe(1));

    // The resume executes 'stop' and its settlement joins the held attempt.
    const respond = session.respondToToolApproval({ approved: true });
    await vi.waitFor(() => expect(commitSpy.mock.calls.length).toBeGreaterThanOrEqual(2));

    // A duplicate message adopts the completed terminal output and joins the
    // same held attempt — its own output is terminal, so on deferral it
    // re-drives settlement.
    const duplicateReceipts: unknown[] = [];
    const duplicate = session.message({
      content: 'needs approval',
      admissionId: 'joined-once-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
      onTerminalCommit: receipt => duplicateReceipts.push(receipt),
    });
    await vi.waitFor(() => expect(commitSpy.mock.calls.length).toBeGreaterThanOrEqual(3));
    await new Promise(resolve => setTimeout(resolve, 0));
    releaseFirstAdmissionLoad();

    await expect(respond).resolves.toMatchObject({ text: 'resumed answer' });
    await expect(message1).resolves.toMatchObject({ finishReason: 'suspended' });
    await expect(duplicate).resolves.toMatchObject({ text: 'resumed answer' });

    // The joined caller re-drove settlement with its own callbacks — it must
    // be notified exactly once. Retaining its observers on the deferred join
    // AND invoking them via the re-driven commit would fire it twice.
    expect(duplicateReceipts).toHaveLength(1);
    expect(originalReceipts).toHaveLength(1);
    expect(
      (
        await storage.loadTerminalAdmission({
          harnessName: 'default',
          sessionId: session.id,
          admissionId: 'joined-once-admission',
          executionGrant: grant,
        })
      )?.status,
    ).toBe('committed');
  });

  it('does not restore a cached suspension after the admission committed and cleared the pending', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    agent.enqueueRun({ finishReason: 'stop', text: 'resumed answer' });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-cleared-restore', generation: 1 };
    const first = await session.message({
      content: 'needs approval',
      admissionId: 'cleared-restore-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(first.finishReason).toBe('suspended');
    expect(session.getRecord().pendingResume?.toolCallId).toBe('tc-1');

    // The duplicate's probe returns the STALE pending snapshot — while it was
    // in flight the resume committed the admission and cleared pendingResume.
    // The restore must not resurrect the consumed interaction.
    let byRunCalls = 0;
    const originalByRun = storage.loadTerminalAdmissionByRun.bind(storage);
    vi.spyOn(storage, 'loadTerminalAdmissionByRun').mockImplementation(async (input: any) => {
      byRunCalls += 1;
      const admission = await originalByRun(input);
      if (byRunCalls === 1) {
        await session.respondToToolApproval({ approved: true });
      }
      return admission;
    });

    const duplicate = session.message({
      content: 'needs approval',
      admissionId: 'cleared-restore-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    await expect(duplicate).resolves.toMatchObject({ finishReason: 'suspended' });
    expect(session.getRecord().pendingResume).toBeUndefined();
  });

  it('does not merge stale cached accounting into a newer same-tool pending generation', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      totalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    agent.enqueueRun({
      finishReason: 'suspended',
      totalUsage: { inputTokens: 15, outputTokens: 8, totalTokens: 23 },
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls -la' } },
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-same-tool', generation: 1 };
    const first = await session.message({
      content: 'needs approval',
      admissionId: 'same-tool-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(first.finishReason).toBe('suspended');
    expect(session.getRecord().pendingResume?.accountedTokenUsage?.totalTokens).toBe(15);

    // Hold the duplicate's admission probe so the resume can park a NEWER
    // generation of the same tool call (same runId + toolCallId, later
    // requestedAt) before the stale restore lands.
    let byRunCalls = 0;
    let releaseProbe!: () => void;
    const probeGate = new Promise<void>(resolve => (releaseProbe = resolve));
    const originalByRun = storage.loadTerminalAdmissionByRun.bind(storage);
    vi.spyOn(storage, 'loadTerminalAdmissionByRun').mockImplementation(async (input: any) => {
      byRunCalls += 1;
      if (byRunCalls === 1) await probeGate;
      return originalByRun(input);
    });
    const duplicate = session.message({
      content: 'needs approval',
      admissionId: 'same-tool-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    await vi.waitFor(() => expect(byRunCalls).toBe(1));

    // Distinct requestedAt keeps the two generations' keys apart.
    await new Promise(resolve => setTimeout(resolve, 5));
    const resumed = await session.respondToToolApproval({ approved: true });
    expect(resumed.finishReason).toBe('suspended');
    const newerAccounting = session.getRecord().pendingResume?.accountedTokenUsage?.totalTokens;
    expect(newerAccounting).toBe(23);

    releaseProbe();
    await expect(duplicate).resolves.toMatchObject({ finishReason: 'suspended' });
    // The stale cached generation must not overwrite the newer park's
    // accounting baseline even though runId/toolCallId match.
    expect(session.getRecord().pendingResume?.accountedTokenUsage?.totalTokens).toBe(23);
  });

  it('reports cancellation to a suspended caller that joined a cancelled commit attempt', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-big', toolName: 'shell', args: { cmd: 'x'.repeat(1_000_000) } },
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-join-cancelled', generation: 1 };

    // Hold the suspended run's commit inside its admission probe so the
    // duplicate can join the parked attempt. The 1MB suspend payload overruns
    // the session-record budget, so the park was already dropped — the
    // attempt cancels rather than defers.
    let admissionLoads = 0;
    let releaseFirstAdmissionLoad!: () => void;
    const firstAdmissionLoadGate = new Promise<void>(resolve => (releaseFirstAdmissionLoad = resolve));
    const originalLoad = storage.loadTerminalAdmission.bind(storage);
    vi.spyOn(storage, 'loadTerminalAdmission').mockImplementation(async (input: any) => {
      admissionLoads += 1;
      if (admissionLoads === 1) await firstAdmissionLoadGate;
      return originalLoad(input);
    });
    const commitSpy = vi.spyOn(session as any, '_commitTerminalHandoff');
    const winnerFailures: Error[] = [];
    const message1 = session.message({
      content: 'needs approval',
      admissionId: 'join-cancelled-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
      onTerminalCommitError: err => winnerFailures.push(err),
    });
    await vi.waitFor(() => expect(admissionLoads).toBe(1));

    const duplicateFailures: Error[] = [];
    const duplicate = session.message({
      content: 'needs approval',
      admissionId: 'join-cancelled-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
      onTerminalCommitError: err => duplicateFailures.push(err),
    });
    await vi.waitFor(() => expect(commitSpy.mock.calls.length).toBeGreaterThanOrEqual(2));
    await new Promise(resolve => setTimeout(resolve, 0));
    releaseFirstAdmissionLoad();

    await expect(message1).resolves.toMatchObject({ finishReason: 'suspended' });
    await expect(duplicate).resolves.toMatchObject({ finishReason: 'suspended' });

    // The shared attempt cancelled its admission — the joined suspended
    // caller must observe that terminal outcome, not hang retained against a
    // grant that can never settle.
    expect(duplicateFailures).toHaveLength(1);
    expect(duplicateFailures[0]!.name).toBe('HarnessTerminalHandoffError:harness.terminal_cancelled');
    expect(winnerFailures.some(err => err.name === 'HarnessTerminalHandoffError:harness.terminal_cancelled')).toBe(
      true,
    );
    expect(
      (
        await storage.loadTerminalAdmission({
          harnessName: 'default',
          sessionId: session.id,
          admissionId: 'join-cancelled-admission',
          executionGrant: grant,
        })
      )?.status,
    ).toBe('cancelled');
  });

  it('does not recount resumed-run usage for a terminal duplicate after reopen', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const terminalHandoff = {
      finalizer: {
        id: 'doxa.chat',
        version: '2026-09-20',
        finalize: async () => ({
          projectionKind: 'chat.summary',
          projectionId: 'response-1',
          payload: {},
        }),
      },
    };
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      totalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: { storage, terminalHandoff },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-reopen-dup', generation: 1 };
    const first = await session.message({
      content: 'needs approval',
      admissionId: 'reopen-dup-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(first.finishReason).toBe('suspended');
    expect(session.getTokenUsage().totalTokens).toBe(15);
    const sessionId = session.id;
    await harness.shutdown();

    // Reopen: the in-memory accounted set is empty even though the suspended
    // run's usage is durably persisted. The resume restores the cumulative
    // counter and commits the terminal output — its delta (23 - 15 = 8) is
    // accounted once.
    const restartedAgent = new MockAgent({ id: 'default' });
    restartedAgent.enqueueRun({
      finishReason: 'stop',
      text: 'resumed answer',
      totalUsage: { inputTokens: 15, outputTokens: 8, totalTokens: 23 },
    });
    const restartedHarness = new Harness({
      agents: { default: restartedAgent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage, terminalHandoff },
    });
    const restarted = await restartedHarness.session({ sessionId, resourceId: 'u1' });

    // Hold the resume's terminal commit inside its admission probe so the
    // duplicate observes still-pending evidence and replays the cached
    // terminal output through the accounting path before the commit lands.
    let admissionLoads = 0;
    let releaseAdmissionLoad!: () => void;
    const admissionLoadGate = new Promise<void>(resolve => (releaseAdmissionLoad = resolve));
    const originalLoad = storage.loadTerminalAdmission.bind(storage);
    vi.spyOn(storage, 'loadTerminalAdmission').mockImplementation(async (input: any) => {
      admissionLoads += 1;
      if (admissionLoads === 1) await admissionLoadGate;
      return originalLoad(input);
    });
    const commitSpy = vi.spyOn(restarted as any, '_commitTerminalHandoff');
    const respond = restarted.respondToToolApproval({ approved: true });
    await vi.waitFor(() => expect(admissionLoads).toBe(1));
    expect(restarted.getTokenUsage().totalTokens).toBe(23);

    const duplicate = restarted.message({
      content: 'needs approval',
      admissionId: 'reopen-dup-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    // The replay must not re-apply the run's cumulative usage — the resume
    // already accounted the (23 - 15) delta. The duplicate's own commit call
    // fires only after its prepare path ran the usage accounting.
    await vi.waitFor(() => expect(commitSpy.mock.calls.length).toBeGreaterThanOrEqual(2));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(restarted.getTokenUsage().totalTokens).toBe(23);

    releaseAdmissionLoad();
    await expect(respond).resolves.toMatchObject({ text: 'resumed answer' });
    await expect(duplicate).resolves.toMatchObject({ text: 'resumed answer' });
    expect(restarted.getTokenUsage().totalTokens).toBe(23);
    await restartedHarness.shutdown();
  });

  it('drains retained terminal observers when the resume admission probe fails', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    agent.enqueueRun({ finishReason: 'stop', text: 'resumed answer' });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-probe-drain', generation: 1 };
    const failures: unknown[] = [];
    const receipts: unknown[] = [];
    const first = await session.message({
      content: 'needs approval',
      admissionId: 'probe-drain-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
      onTerminalCommit: receipt => receipts.push(receipt),
      onTerminalCommitError: err => failures.push(err),
    });
    expect(first.finishReason).toBe('suspended');

    // The suspended commit defers and retains this caller's observers under
    // the admission's run id. Wait for the retention before the resume.
    await vi.waitFor(() => expect((session as any)._terminalObserversByRunId.size).toBe(1));

    // The resume's settlement probe fails before `_commitTerminalHandoff` can
    // take ownership of the drain — the retained observer must still hear a
    // terminal failure and the admission must stay recoverable. The probe is
    // gated on `resumedAt` so only the settle-time call (after the respond's
    // admission CAS stamped it) rejects, not the resume's pre-CAS probe.
    const originalByRun = storage.loadTerminalAdmissionByRun.bind(storage);
    let probeFailed = false;
    vi.spyOn(storage, 'loadTerminalAdmissionByRun').mockImplementation(async (input: any) => {
      if (session.getRecord().pendingResume?.resumedAt !== undefined) {
        probeFailed = true;
        throw new Error('probe lost');
      }
      return originalByRun(input);
    });
    // The raw probe failure is wrapped in the typed indeterminate outcome.
    await expect(session.respondToToolApproval({ approved: true })).rejects.toThrow(
      'Native terminal finalization is indeterminate and requires reconciliation',
    );
    expect(probeFailed).toBe(true);
    expect(failures).toHaveLength(1);
    expect(receipts).toHaveLength(0);
    expect((session as any)._terminalObserversByRunId.size).toBe(0);
    // The durable admission is still pending — the probe failure must not
    // terminalize what it could not read.
    expect(
      (
        await storage.loadTerminalAdmission({
          harnessName: 'default',
          sessionId: session.id,
          admissionId: 'probe-drain-admission',
          executionGrant: grant,
        })
      )?.status,
    ).toBe('pending');
  });

  it('does not apply cached-restore usage when a CAS retry loses the restore fence', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
      totalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-cas-retry', generation: 1 };
    const first = await session.message({
      content: 'needs approval',
      admissionId: 'cas-retry-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(first.finishReason).toBe('suspended');
    expect(session.getTokenUsage().totalTokens).toBe(15);

    // Sabotage the restore flush once: a concurrent owner clears pendingResume
    // (a commit won the grant) and bumps the version, so the retried updater
    // hits the restore fence and skips the write. The writeApplied flag from
    // the losing attempt must not leak usage into the retried flush.
    const originalSave = storage.saveSession.bind(storage);
    let sabotageArmed = true;
    vi.spyOn(storage, 'saveSession').mockImplementation(async (record: any, opts?: any) => {
      if (sabotageArmed && record.pendingResume?.toolCallId === 'tc-1' && record.pendingResume.runId === first.runId) {
        sabotageArmed = false;
        const latest = await storage.loadSession({ harnessName: 'default', sessionId: session.id });
        await originalSave(
          { ...latest!, pendingResume: undefined },
          { harnessName: 'default', ownerId: opts?.ownerId, ifVersion: latest!.version },
        );
        throw new HarnessStorageVersionConflictError(session.id, opts?.ifVersion ?? 0, latest!.version + 1);
      }
      return originalSave(record, opts);
    });

    const duplicate = session.message({
      content: 'needs approval',
      admissionId: 'cas-retry-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    await expect(duplicate).resolves.toMatchObject({ finishReason: 'suspended' });
    expect(sabotageArmed).toBe(false);
    // The skipped restore must not re-apply the suspended run's cumulative
    // usage — the durable baseline is gone (pending cleared), so accounting it
    // would double-count the full 15.
    expect(session.getTokenUsage().totalTokens).toBe(15);
    expect(session.getRecord().pendingResume).toBeUndefined();
  });

  it('recovers an approved plan mode transition when finalizing a committed admission after a crashed respond', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-P', toolName: 'submit_plan', args: { title: 't', plan: 'p' } },
    });
    agent.enqueueRun({ finishReason: 'stop', text: 'resumed answer' });
    const { harness } = setupHarness({
      agents: { default: agent },
      modes: [
        { id: 'planner', agentId: 'default', transitionsTo: 'builder' },
        { id: 'builder', agentId: 'default' },
      ],
      defaultModeId: 'planner',
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-mode-recover', generation: 1 };
    const first = await session.message({
      content: 'plan',
      admissionId: 'mode-recover-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
    });
    expect(first.finishReason).toBe('suspended');
    const pending = session.getRecord().pendingResume!;
    expect(pending.kind).toBe('plan-approval');

    // The respond commits the terminal winner, then dies in the post-commit
    // bookkeeping flush — the durable record keeps the resumed pending plus
    // the 'accepted' receipt that persists the caller's approval payload.
    let commitSealed = false;
    const originalCommit = storage.commitTerminalHandoff.bind(storage);
    vi.spyOn(storage, 'commitTerminalHandoff').mockImplementation(async (input: any) => {
      const receipt = await originalCommit(input);
      commitSealed = true;
      return receipt;
    });
    const originalSave = storage.saveSession.bind(storage);
    let failedOnce = false;
    vi.spyOn(storage, 'saveSession').mockImplementation(async (record: any, opts?: any) => {
      if (commitSealed && !failedOnce) {
        failedOnce = true;
        throw new Error('pendingResume flush lost');
      }
      return originalSave(record, opts);
    });
    // The raw flush failure is wrapped in the public internal error; the
    // sabotage flags prove which write was lost.
    await expect(
      session.respondToPlanApproval({
        approved: true,
        responseId: 'resp-mode-1',
        itemId: pending.itemId,
        runId: pending.runId,
        toolCallId: pending.toolCallId,
        pendingRequestedAt: pending.requestedAt,
      } as any),
    ).rejects.toThrow('An internal harness error occurred');
    expect(commitSealed).toBe(true);
    expect(failedOnce).toBe(true);
    expect(session.getCurrentMode().id).toBe('planner');
    const parked = session.getRecord().pendingResume!;
    expect(parked.resumedAt).toBeDefined();
    const receipt = session.getRecord().inboxResponseReceipts?.['resp-mode-1'];
    expect(receipt?.status).toBe('accepted');

    // Deadline recovery must replay the persisted transition — the approval
    // data survived on the receipt, and clearing the pending without it would
    // leave the old mode and permission policy active forever.
    vi.restoreAllMocks();
    const generation = (session as any)._pendingInteractionGeneration(parked);
    const past = Date.now() - 1;
    const recovered = await (session as any)._internalExpirePendingInteractionGeneration({
      ...generation,
      resumeRecoveryAt: past,
      dueAt: past,
    });
    expect(recovered).toBe(true);
    expect(session.getCurrentMode().id).toBe('builder');
    expect(session.getRecord().pendingResume).toBeUndefined();
    expect(session.getRecord().inboxResponseReceipts?.['resp-mode-1']?.status).toBe('applied');
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

  it('drains retained observers with the sealed receipt when a concurrent commit wins the cancel race', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-commit-race', generation: 1 };
    const failures: unknown[] = [];
    const receipts: Array<{ status?: string; admission?: { status?: string } }> = [];
    const first = await session.message({
      content: 'needs approval',
      admissionId: 'commit-race-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
      onTerminalCommit: receipt => receipts.push(receipt as (typeof receipts)[number]),
      onTerminalCommitError: err => failures.push(err),
    });
    expect(first.finishReason).toBe('suspended');
    await vi.waitFor(() => expect((session as any)._terminalObserversByRunId.size).toBe(1));

    const stored = await storage.loadTerminalAdmission({
      harnessName: 'default',
      sessionId: session.id,
      admissionId: 'commit-race-admission',
      executionGrant: grant,
    });
    const pendingEvidence = await storage.loadMessageResultEvidence({
      harnessName: 'default',
      sessionId: session.id,
      resourceId: 'u1',
      threadId: session.threadId,
      signalId: stored!.signalId,
    });
    const originalCommit = storage.commitTerminalHandoff.bind(storage);
    const originalCancel = storage.cancelTerminalHandoff.bind(storage);
    // A concurrent worker seals the admission after the cancel path's probe
    // read 'pending' but before its cancel write lands — the receipt reports
    // 'committed' and THIS session's retained observers must still hear it.
    vi.spyOn(storage, 'cancelTerminalHandoff').mockImplementation(async (input: any) => {
      await originalCommit({
        admission: stored!,
        resultEvidence: {
          ...pendingEvidence!,
          status: 'completed',
          result: { text: 'sealed by the winning worker' },
          updatedAt: Date.now(),
        },
        terminalResult: { status: 'completed', runId: stored!.runId, completedAt: Date.now() },
        projection: { projectionKind: 'chat.summary', projectionId: 'summary-race', payload: {} },
      } as any);
      return originalCancel(input);
    });

    await session.abortActiveWork();
    expect(failures).toHaveLength(0);
    expect(receipts).toHaveLength(1);
    expect(receipts[0]!.status).toBe('duplicate');
    expect(receipts[0]!.admission?.status).toBe('committed');
    expect((session as any)._terminalObserversByRunId.size).toBe(0);
    expect(
      (
        await storage.loadTerminalAdmission({
          harnessName: 'default',
          sessionId: session.id,
          admissionId: 'commit-race-admission',
          executionGrant: grant,
        })
      )?.status,
    ).toBe('committed');
  });

  it('drains retained observers with the fenced outcome when a duplicate cancel races a fence', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true },
      sessionRecordProjection: { enabled: true },
    });
    const agent = new MockAgent({ id: 'default' });
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const { harness } = setupHarness({
      agents: { default: agent },
      sessions: {
        storage,
        terminalHandoff: {
          finalizer: {
            id: 'doxa.chat',
            version: '2026-09-20',
            finalize: async () => ({
              projectionKind: 'chat.summary',
              projectionId: 'response-1',
              payload: {},
            }),
          },
        },
      },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const grant = { key: 'usage-claim-fence-race', generation: 1 };
    const failures: Array<{ name?: string }> = [];
    const receipts: unknown[] = [];
    const first = await session.message({
      content: 'needs approval',
      admissionId: 'fence-race-admission',
      executionAuthorityGrant: grant,
      terminalAdmissionSeed: { v: 1 },
      onTerminalCommit: receipt => receipts.push(receipt),
      onTerminalCommitError: err => failures.push(err as (typeof failures)[number]),
    });
    expect(first.finishReason).toBe('suspended');
    await vi.waitFor(() => expect((session as any)._terminalObserversByRunId.size).toBe(1));

    const originalCancel = storage.cancelTerminalHandoff.bind(storage);
    // Race inside the cancel window: an external cancel tombstones the grant
    // and the row is fenced (e.g. session deletion on another worker) before
    // our write lands — the receipt is 'duplicate' over a 'fenced' admission.
    vi.spyOn(storage, 'cancelTerminalHandoff').mockImplementation(async (input: any) => {
      await originalCancel(input);
      for (const row of (storage as any).db.harnessTerminalAdmissions.values()) {
        if (row.admissionId === input.admissionId) row.status = 'fenced';
      }
      return originalCancel(input);
    });

    await session.abortActiveWork();
    expect(receipts).toHaveLength(0);
    expect(failures).toHaveLength(1);
    expect(failures[0]!.name).toBe('HarnessTerminalHandoffError:harness.terminal_fenced');
    expect((session as any)._terminalObserversByRunId.size).toBe(0);
    expect(
      (
        await storage.loadTerminalAdmission({
          harnessName: 'default',
          sessionId: session.id,
          admissionId: 'fence-race-admission',
          executionGrant: grant,
        })
      )?.status,
    ).toBe('fenced');
  });
});
