/**
 * Harness v1 — sandbox-access request API tests.
 *
 *   - ctx.registerSandboxAccess persists a pending resume of kind
 *     'sandbox-access' and emits sandbox_access_requested +
 *     suspension_required
 *   - the payload preserves semanticType, reason, and the
 *     caller-supplied opaque payload through the round-trip
 *   - session.respondToSandboxAccess({approved}) emits
 *     sandbox_access_resolved before resuming the tool
 *   - semantic types align with WorkspacePolicyActionKind
 *   - missing runId / invalid semanticType raise typed validation
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
    super({ id: name, name, instructions: 'fake', model: 'openai/gpt-4o-mini' as any });
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
  return { harness, session };
}

describe('Session._registerSandboxAccess', () => {
  it('persists a pending resume of kind "sandbox-access" with the supplied payload', async () => {
    const { session } = await setup();
    // Stub the active run id since FakeAgent's stream doesn't loop a turn.
    (session as any)._currentRunId = 'run-1';
    await (session as any)._registerSandboxAccess({
      requestId: 'sa-1',
      semanticType: 'command',
      reason: 'CI test runner needs shell access',
      payload: { command: 'pnpm test' },
    });
    const pending = session.getRecord().pendingResume;
    expect(pending).toMatchObject({
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

  it('emits sandbox_access_requested AND suspension_required', async () => {
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
    const requested = events.find(e => e.type === 'sandbox_access_requested') as any;
    const suspension = events.find(e => e.type === 'suspension_required') as any;
    expect(requested).toMatchObject({
      requestId: 'sa-2',
      toolCallId: 'sa-2',
      semanticType: 'network',
      reason: 'outbound HTTPS to dependency mirror',
      payload: { host: 'registry.npmjs.org', port: 443 },
    });
    expect(suspension).toMatchObject({
      kind: 'sandbox-access',
      toolCallId: 'sa-2',
    });
  });

  it('rejects unknown semanticType', async () => {
    const { session } = await setup();
    (session as any)._currentRunId = 'run-1';
    await expect(
      (session as any)._registerSandboxAccess({
        requestId: 'sa-3',
        semanticType: 'gpu',
        reason: 'compute',
      }),
    ).rejects.toMatchObject({ name: 'HarnessValidationError' });
  });

  it('rejects empty requestId', async () => {
    const { session } = await setup();
    (session as any)._currentRunId = 'run-1';
    await expect(
      (session as any)._registerSandboxAccess({
        requestId: '',
        semanticType: 'file',
      }),
    ).rejects.toMatchObject({ name: 'HarnessValidationError' });
  });

  it('requires an active runId', async () => {
    const { session } = await setup();
    // No _currentRunId set
    await expect(
      (session as any)._registerSandboxAccess({
        requestId: 'sa-4',
        semanticType: 'file',
      }),
    ).rejects.toMatchObject({ name: 'HarnessValidationError' });
  });

  it('rejects non-JSON-serializable payload (function, Date, NaN)', async () => {
    const { session } = await setup();
    (session as any)._currentRunId = 'run-1';
    // Functions are not valid JSON.
    await expect(
      (session as any)._registerSandboxAccess({
        requestId: 'sa-bad-1',
        semanticType: 'command',
        payload: { onSuccess: () => 'side-effect' } as any,
      }),
    ).rejects.toMatchObject({ name: 'HarnessValidationError' });
    // Dates are not plain JSON objects.
    await expect(
      (session as any)._registerSandboxAccess({
        requestId: 'sa-bad-2',
        semanticType: 'command',
        payload: { when: new Date() } as any,
      }),
    ).rejects.toMatchObject({ name: 'HarnessValidationError' });
    // NaN is not a finite JSON number.
    await expect(
      (session as any)._registerSandboxAccess({
        requestId: 'sa-bad-3',
        semanticType: 'command',
        payload: { ratio: NaN } as any,
      }),
    ).rejects.toMatchObject({ name: 'HarnessValidationError' });
  });

  it('idempotent re-registration with the same id is a no-op', async () => {
    const { session } = await setup();
    (session as any)._currentRunId = 'run-1';
    await (session as any)._registerSandboxAccess({
      requestId: 'sa-5',
      semanticType: 'mcp',
    });
    const events: HarnessEvent[] = [];
    session.subscribe(e => events.push(e));
    // Re-register the same id under the same runId — no-op.
    await (session as any)._registerSandboxAccess({
      requestId: 'sa-5',
      semanticType: 'mcp',
    });
    // No additional sandbox_access_requested emitted.
    expect(events.filter(e => e.type === 'sandbox_access_requested')).toHaveLength(0);
  });
});

describe('Session.respondToSandboxAccess', () => {
  it('emits sandbox_access_resolved when the approver responds', async () => {
    const { session } = await setup();
    (session as any)._currentRunId = 'run-1';
    await (session as any)._registerSandboxAccess({
      requestId: 'sa-6',
      semanticType: 'file',
      reason: 'read /tmp/build.log',
    });
    const events: HarnessEvent[] = [];
    session.subscribe(e => events.push(e));
    // The respond path delegates to _resume which will fail because
    // FakeAgent has no resume stream. We catch the resume failure
    // since the resolution EVENT must still fire first.
    await session.respondToSandboxAccess({ approved: true }).catch(() => {
      // Ignore the resume-path failure; we only test the event.
    });
    const resolved = events.find(e => e.type === 'sandbox_access_resolved') as any;
    expect(resolved).toMatchObject({
      requestId: 'sa-6',
      toolCallId: 'sa-6',
      semanticType: 'file',
      approved: true,
    });
  });

  it('records deny verdict on sandbox_access_resolved', async () => {
    const { session } = await setup();
    (session as any)._currentRunId = 'run-1';
    await (session as any)._registerSandboxAccess({
      requestId: 'sa-7',
      semanticType: 'command',
    });
    const events: HarnessEvent[] = [];
    session.subscribe(e => events.push(e));
    await session.respondToSandboxAccess({ approved: false }).catch(() => {});
    const resolved = events.find(e => e.type === 'sandbox_access_resolved') as any;
    expect(resolved.approved).toBe(false);
  });
});
