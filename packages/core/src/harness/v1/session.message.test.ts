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
import { HarnessStorageAdmissionConflictError } from '../../storage/domains/harness';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';

import { buildFakeOutput, extractSignalContents } from './__test-utils__/fake-output';
import { MockAgent } from './__test-utils__/mock-agent';
import { setupHarness } from './__test-utils__/setup';
import { HarnessAdmissionConflictError, HarnessOverrideConflictError, HarnessValidationError } from './errors';
import { Harness } from './harness';

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

async function waitForStreamCalls(agent: MockAgent, expected: number): Promise<void> {
  for (let i = 0; i < 100 && agent.streamCalls.length < expected; i++) {
    await new Promise<void>(resolve => setImmediate(resolve));
  }
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
        kind: 'message',
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
    expect((agent.calls[0]!.messages as { type: string; contents: unknown }).type).toBe('user-message');
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

  it('requires tool approval by default for message turns', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'r-approval', threadId: { fresh: true } });

    await session.message({ content: 'hi' });

    expect(agent.calls[0]!.options.requireToolApproval).toBe(true);
  });

  it('does not require tool approval when per-turn or session yolo is enabled', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'r-yolo', threadId: { fresh: true } });

    await session.message({ content: 'turn yolo', yolo: true });
    await session.setState({ yolo: true });
    await session.message({ content: 'state yolo' });

    expect(agent.calls[0]!.options.requireToolApproval).toBeUndefined();
    expect(agent.calls[1]!.options.requireToolApproval).toBeUndefined();
  });

  it('forwards the caller-supplied abortSignal (chained into the per-turn signal)', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const ac = new AbortController();
    await session.message({ content: 'hi', abortSignal: ac.signal });
    // Session mints its own per-turn AbortController so `session.abort()` can
    // also cancel the run. Caller's signal is linked into it, so aborting the
    // caller's controller must abort the signal handed to the agent.
    const turnSignal = agent.calls[0]!.options.abortSignal as AbortSignal;
    expect(turnSignal).toBeInstanceOf(AbortSignal);
    expect(turnSignal).not.toBe(ac.signal);
    expect(turnSignal.aborted).toBe(false);
  });

  it('aborting the caller signal aborts the per-turn signal handed to the agent', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const ac = new AbortController();
    await session.message({ content: 'hi', abortSignal: ac.signal });
    const turnSignal = agent.calls[0]!.options.abortSignal as AbortSignal;
    ac.abort('caller-cancelled');
    expect(turnSignal.aborted).toBe(true);
    expect((turnSignal as { reason?: unknown }).reason).toBe('caller-cancelled');
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
      if (!skippedFirstLookup && opts.kind === 'message' && opts.admissionId === 'admit-race-completed') {
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
      if (raced && opts.kind === 'message' && opts.admissionId === 'exact-race') {
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

      override async writeMessageResultEvidence(record: any): Promise<{ created: boolean }> {
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

    await expect(session.message({ content: 'hi', admissionId: 'admission-1' })).rejects.toThrow(
      'completed evidence unavailable',
    );

    expect(storage.writes).toContain('completed');
    expect(storage.writes).not.toContain('failed');
  });

  it('fails stream admission startup when post-dispatch pending evidence cannot be persisted', async () => {
    class PostDispatchPendingEvidenceFailingStorage extends InMemoryHarness {
      readonly writes: any[] = [];
      pendingAttempts = 0;

      override async writeMessageResultEvidence(record: any): Promise<{ created: boolean }> {
        this.writes.push(record);
        if (record.admissionId === 'stream-pending-failure' && record.status === 'pending') {
          this.pendingAttempts++;
          if (this.pendingAttempts === 2) {
            throw new Error('post-dispatch pending evidence unavailable');
          }
        }
        return super.writeMessageResultEvidence(record);
      }
    }
    const agent = new LiveStreamFakeAgent('default');
    const storage = new PostDispatchPendingEvidenceFailingStorage({ db: new InMemoryDB() });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    try {
      await expect(
        session.message({ content: 'go', admissionId: 'stream-pending-failure', stream: true }),
      ).rejects.toThrow('post-dispatch pending evidence unavailable');

      expect(agent.calls[0]!.options.abortSignal.aborted).toBe(true);
      await nextTick();
      const failedWrite = storage.writes.find(record => record.status === 'failed');
      expect(failedWrite).toBeDefined();
      expect(failedWrite).toMatchObject({
        admissionId: 'stream-pending-failure',
        status: 'failed',
      });
      await expect(
        storage.loadMessageResultEvidence({
          harnessName: (session as any)._record.harnessName,
          sessionId: session.id,
          resourceId: session.resourceId,
          threadId: session.threadId,
          signalId: failedWrite.signalId,
        }),
      ).resolves.toMatchObject({
        admissionId: 'stream-pending-failure',
        status: 'failed',
      });

      agent.releaseStream?.();
      await nextTick();
      await nextTick();

      expect(failedWrite).toBeDefined();
      await expect(
        storage.loadMessageResultEvidence({
          harnessName: (session as any)._record.harnessName,
          sessionId: session.id,
          resourceId: session.resourceId,
          threadId: session.threadId,
          signalId: failedWrite.signalId,
        }),
      ).resolves.toMatchObject({
        admissionId: 'stream-pending-failure',
        status: 'failed',
      });
      await expect(
        session.message({ content: 'go', admissionId: 'stream-pending-failure', stream: true }),
      ).rejects.toMatchObject({
        name: 'HarnessValidationError',
        message: expect.stringContaining('duplicate stream is no longer live'),
      });
      expect(agent.calls).toHaveLength(1);
    } finally {
      agent.releaseStream?.();
      await nextTick();
    }
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
      pendingAttempts = 0;

      override async writeMessageResultEvidence(record: any): Promise<{ created: boolean }> {
        if (record.admissionId === 'stream-pending-stalled-failure' && record.status === 'pending') {
          this.pendingAttempts++;
          if (this.pendingAttempts === 2) {
            throw new Error('post-dispatch pending evidence unavailable');
          }
        }
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
    const agent = new LiveStreamFakeAgent('default');
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
        expect(outcome!.err).toMatchObject({ message: 'post-dispatch pending evidence unavailable' });
      }
      expect(agent.calls[0]!.options.abortSignal.aborted).toBe(true);

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
    expect(agent.calls[0]!.options.toolsets).toEqual(
      expect.objectContaining({
        'call:additional': tools,
        'harness:builtin': expect.objectContaining({
          ask_user: expect.anything(),
          submit_plan: expect.anything(),
          task_write: expect.anything(),
          task_update: expect.anything(),
          task_complete: expect.anything(),
          task_check: expect.anything(),
        }),
      }),
    );
  });

  it('rejects prepareStep when message delivery drains into an active run', async () => {
    const agent = new MockAgent({ id: 'default' });
    let release!: () => void;
    const hold = new Promise<void>(resolve => {
      release = resolve;
    });
    agent.enqueueRun({ holdUntil: hold });
    const { harness } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const first = session.message({ content: 'first' });
    await waitForStreamCalls(agent, 1);

    await expect(
      session.message({
        content: 'second',
        prepareStep: () => ({ activeTools: [] }),
      }),
    ).rejects.toBeInstanceOf(HarnessOverrideConflictError);

    release();
    await first;
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
