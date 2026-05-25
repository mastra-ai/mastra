/**
 * Harness v1 — sandbox-access request API.
 */

import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { buildFakeOutput } from './__test-utils__/fake-output';

import type { HarnessEvent } from './events';
import { Harness } from './harness';

class FakeAgent extends Agent<any, any, any> {
  chunks: any[] = [];
  fullOutput: any = {
    text: 'ok',
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
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
    totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
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
    super({ id: name, name, instructions: 'fake', model: '__GATEWAY_OPENAI_MODEL_MINI__' as any });
  }

  async stream(_messages: any, options?: any): Promise<any> {
    const out = buildFakeOutput({
      runId: options?.runId ?? this.fullOutput.runId,
      fullOutput: this.fullOutput,
      chunks: this.chunks,
    });
    this._internalRegisterStreamRun(out, (options ?? {}) as any);
    return out;
  }

  async generate(_messages: any, _options?: any): Promise<any> {
    return this.fullOutput;
  }

  async resumeStream(_resumeData: any, options?: any): Promise<any> {
    return this.stream(undefined, options);
  }
}

async function setup() {
  const agent = new FakeAgent('default');
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { default: agent } as any,
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: { storage },
  });
  const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
  return { session };
}

describe('Session._registerSandboxAccess', () => {
  it('persists a sandbox-access pending resume with structured payload', async () => {
    const { session } = await setup();
    (session as any)._currentRunId = 'run-1';

    await (session as any)._registerSandboxAccess({
      requestId: 'sa-1',
      semanticType: 'command',
      reason: 'CI test runner needs shell access',
      payload: { command: 'pnpm test' },
    });

    expect(session.getRecord().pendingResume).toMatchObject({
      kind: 'sandbox-access',
      itemId: 'sa-1',
      runId: 'run-1',
      toolCallId: 'sa-1',
      payload: {
        sandboxAccess: {
          semanticType: 'command',
          reason: 'CI test runner needs shell access',
          payload: { command: 'pnpm test' },
        },
      },
    });
  });

  it('emits sandbox_access_requested and suspension_required after registration', async () => {
    const { session } = await setup();
    (session as any)._currentRunId = 'run-1';
    const events: HarnessEvent[] = [];
    session.subscribe(e => events.push(e));

    await (session as any)._registerSandboxAccess({
      requestId: 'sa-2',
      semanticType: 'network',
      reason: 'outbound HTTPS to dependency mirror',
      payload: { host: 'registry.npmjs.org', port: 443 },
    });

    expect(events.find(e => e.type === 'sandbox_access_requested')).toMatchObject({
      type: 'sandbox_access_requested',
      requestId: 'sa-2',
      toolCallId: 'sa-2',
      semanticType: 'network',
      reason: 'outbound HTTPS to dependency mirror',
      payload: { host: 'registry.npmjs.org', port: 443 },
    });
    expect(events.find(e => e.type === 'suspension_required')).toMatchObject({
      type: 'suspension_required',
      kind: 'sandbox-access',
      toolCallId: 'sa-2',
    });
  });

  it('rejects invalid request shape', async () => {
    const { session } = await setup();
    (session as any)._currentRunId = 'run-1';

    await expect(
      (session as any)._registerSandboxAccess({
        requestId: '',
        semanticType: 'file',
      }),
    ).rejects.toMatchObject({ name: 'HarnessValidationError' });
    await expect(
      (session as any)._registerSandboxAccess({
        requestId: 'sa-3',
        semanticType: 'gpu',
      }),
    ).rejects.toMatchObject({ name: 'HarnessValidationError' });
    await expect(
      (session as any)._registerSandboxAccess({
        requestId: 'sa-4',
        semanticType: 'file',
        payload: { when: new Date() },
      }),
    ).rejects.toMatchObject({ name: 'HarnessValidationError' });
  });

  it('requires an active run id', async () => {
    const { session } = await setup();

    await expect(
      (session as any)._registerSandboxAccess({
        requestId: 'sa-5',
        semanticType: 'file',
      }),
    ).rejects.toMatchObject({ name: 'HarnessValidationError' });
  });

  it('treats duplicate registration for the same request as a no-op', async () => {
    const { session } = await setup();
    (session as any)._currentRunId = 'run-1';
    await (session as any)._registerSandboxAccess({
      requestId: 'sa-6',
      semanticType: 'mcp',
    });
    const events: HarnessEvent[] = [];
    session.subscribe(e => events.push(e));

    await (session as any)._registerSandboxAccess({
      requestId: 'sa-6',
      semanticType: 'mcp',
    });

    expect(events.filter(e => e.type === 'sandbox_access_requested')).toHaveLength(0);
  });

  it('rejects duplicate request ids with different payloads', async () => {
    const { session } = await setup();
    (session as any)._currentRunId = 'run-1';
    await (session as any)._registerSandboxAccess({
      requestId: 'sa-6',
      semanticType: 'file',
      payload: { path: '/tmp/a' },
    });

    await expect(
      (session as any)._registerSandboxAccess({
        requestId: 'sa-6',
        semanticType: 'file',
        payload: { path: '/tmp/b' },
      }),
    ).rejects.toMatchObject({ name: 'HarnessValidationError' });
  });

  it('exposes registerSandboxAccess on the per-turn request context', async () => {
    const { session } = await setup();
    (session as any)._currentRunId = 'run-context';
    const requestContext = await (session as any)._buildRequestContext({
      modeId: 'default',
      modelId: 'fake',
      abortSignal: new AbortController().signal,
    });
    const harnessCtx = requestContext.get('harness');

    await harnessCtx.registerSandboxAccess({
      requestId: 'sa-context',
      semanticType: 'file',
      reason: 'read external config',
      payload: { path: '/tmp/config' },
    });

    expect(session.getRecord().pendingResume).toMatchObject({
      kind: 'sandbox-access',
      itemId: 'sa-context',
      runId: 'run-context',
      toolCallId: 'sa-context',
    });
  });
});

describe('Session.respondToSandboxAccess', () => {
  it('emits sandbox_access_resolved for approval responses', async () => {
    const { session } = await setup();
    (session as any)._currentRunId = 'run-1';
    await (session as any)._registerSandboxAccess({
      requestId: 'sa-7',
      semanticType: 'file',
      reason: 'read /tmp/build.log',
    });
    const events: HarnessEvent[] = [];
    session.subscribe(e => events.push(e));

    await session.respondToSandboxAccess({ approved: true });

    expect(events.find(e => e.type === 'sandbox_access_resolved')).toMatchObject({
      type: 'sandbox_access_resolved',
      requestId: 'sa-7',
      toolCallId: 'sa-7',
      semanticType: 'file',
      approved: true,
    });
    expect(session.getRecord().pendingResume).toBeUndefined();
  });

  it('records denial verdicts on sandbox_access_resolved', async () => {
    const { session } = await setup();
    (session as any)._currentRunId = 'run-1';
    await (session as any)._registerSandboxAccess({
      requestId: 'sa-8',
      semanticType: 'command',
    });
    const events: HarnessEvent[] = [];
    session.subscribe(e => events.push(e));

    await session.respondToSandboxAccess({ approved: false });

    expect(events.find(e => e.type === 'sandbox_access_resolved')).toMatchObject({
      type: 'sandbox_access_resolved',
      requestId: 'sa-8',
      semanticType: 'command',
      approved: false,
    });
    expect(session.getRecord().pendingResume).toBeUndefined();
  });

  it('rejects wrong-kind pending resumes without emitting sandbox_access_resolved', async () => {
    const { session } = await setup();
    (session as any)._currentRunId = 'run-1';
    await (session as any)._registerQuestion({
      questionId: 'question-1',
      question: 'Pick one',
    });
    const events: HarnessEvent[] = [];
    session.subscribe(e => events.push(e));

    await expect(session.respondToSandboxAccess({ approved: true })).rejects.toMatchObject({
      name: 'HarnessValidationError',
    });

    expect(events.filter(e => e.type === 'sandbox_access_resolved')).toHaveLength(0);
  });
});
