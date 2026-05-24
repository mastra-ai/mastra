/**
 * Harness v1 — per-actor grants tests.
 *
 *   - actorKey() produces stable composite strings
 *   - grantTool({actor}) creates an overlay only for that actor
 *   - the resolver suppresses 'ask' for the actor that holds the grant
 *     and leaves other actors unchanged
 *   - revokeTool({actor}) removes only that actor's grant
 *   - grants get tracked at session-level (default API) unchanged
 *   - applyProfile clears actorGrants inside the same flush
 *   - legacy sessions (no actorGrants) behave identically to pre-S2
 *   - resolver signature accepts args (S5 placeholder); for now S2
 *     drops args at the callsite — re-asserted by the wire-up test
 *     in Slice 5
 */

import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { buildFakeOutput } from './__test-utils__/fake-output';

import { Harness } from './harness';
import { actorKey } from './types';
import type { HarnessActorIdentity } from './types';

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
    defaultPermissionPolicy: 'ask',
    toolCategories: { 'shell.run': 'execute', 'fs.write': 'edit' },
  });
  const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
  return { harness, session };
}

describe('actorKey', () => {
  it('produces a deterministic ${kind}:${id} composite', () => {
    expect(actorKey({ kind: 'a2a', id: 'agent-A' })).toBe('a2a:agent-A');
    expect(actorKey({ kind: 'channel', id: 'slack:T1:C1:U1' })).toBe('channel:slack:T1:C1:U1');
    expect(actorKey({ kind: 'cli', id: 'op-123' })).toBe('cli:op-123');
    expect(actorKey({ kind: 'server', id: 'route-7' })).toBe('server:route-7');
  });
});

describe('session.permissions.grantTool({actor}) — overlay semantics', () => {
  it('per-actor grant suppresses ask for that actor only', async () => {
    const { session } = await setup();
    const actorA: HarnessActorIdentity = { kind: 'a2a', id: 'agent-A' };
    const actorB: HarnessActorIdentity = { kind: 'a2a', id: 'agent-B' };

    await session.permissions.grantTool({ toolName: 'shell.run', actor: actorA });

    // Resolver is private; reach via cast for the test. Production
    // code calls through the request-context resolveToolPermission
    // hook which forwards `params.actor`.
    expect((session as any)._resolveToolPermissionPolicy('shell.run', { actor: actorA })).toBe('allow');
    expect((session as any)._resolveToolPermissionPolicy('shell.run', { actor: actorB })).toBe('ask');
    expect((session as any)._resolveToolPermissionPolicy('shell.run')).toBe('ask');
  });

  it('per-category grant on actor suppresses ask for any tool in that category', async () => {
    const { session } = await setup();
    const actorA: HarnessActorIdentity = { kind: 'channel', id: 'slack:T1:C1:U1' };
    await session.permissions.grantCategory({ category: 'execute', actor: actorA });
    expect((session as any)._resolveToolPermissionPolicy('shell.run', { actor: actorA })).toBe('allow');
    expect((session as any)._resolveToolPermissionPolicy('shell.run')).toBe('ask');
  });

  it('session-level grant still applies to every caller (preserves legacy behavior)', async () => {
    const { session } = await setup();
    const actorA: HarnessActorIdentity = { kind: 'a2a', id: 'agent-A' };
    await session.permissions.grantTool({ toolName: 'shell.run' });
    expect((session as any)._resolveToolPermissionPolicy('shell.run')).toBe('allow');
    expect((session as any)._resolveToolPermissionPolicy('shell.run', { actor: actorA })).toBe('allow');
  });

  it('revokeTool({actor}) removes only that actor', async () => {
    const { session } = await setup();
    const actorA: HarnessActorIdentity = { kind: 'a2a', id: 'agent-A' };
    const actorB: HarnessActorIdentity = { kind: 'a2a', id: 'agent-B' };
    await session.permissions.grantTool({ toolName: 'shell.run', actor: actorA });
    await session.permissions.grantTool({ toolName: 'shell.run', actor: actorB });
    await session.permissions.revokeTool({ toolName: 'shell.run', actor: actorA });
    expect((session as any)._resolveToolPermissionPolicy('shell.run', { actor: actorA })).toBe('ask');
    expect((session as any)._resolveToolPermissionPolicy('shell.run', { actor: actorB })).toBe('allow');
  });

  it('getGrants({actor}) returns ONLY that actor overlay, not the session-level union', async () => {
    const { session } = await setup();
    const actorA: HarnessActorIdentity = { kind: 'a2a', id: 'agent-A' };
    await session.permissions.grantTool({ toolName: 'shell.run' });
    await session.permissions.grantTool({ toolName: 'fs.write', actor: actorA });
    const sessionGrants = session.permissions.getGrants();
    const actorOverlay = session.permissions.getGrants({ actor: actorA });
    expect(sessionGrants.tools).toEqual(['shell.run']);
    expect(actorOverlay.tools).toEqual(['fs.write']);
  });
});

describe('permission_granted / permission_revoked carry actor identity', () => {
  it('event payload includes actor when grant is actor-scoped (subscribers can distinguish overlay vs baseline)', async () => {
    const { harness, session } = await setup();
    const actorA: HarnessActorIdentity = { kind: 'a2a', id: 'agent-A' };
    const sessionEvents: any[] = [];
    const harnessEvents: any[] = [];
    session.subscribe(e => sessionEvents.push(e));
    harness.subscribe(e => harnessEvents.push(e));
    await session.permissions.grantTool({ toolName: 'shell.run', actor: actorA });
    const granted = sessionEvents.find(e => e.type === 'permission_granted');
    expect(granted).toBeDefined();
    expect(granted.toolName).toBe('shell.run');
    expect(granted.actor).toEqual(actorA);
    // Bridge forwards the same event verbatim — harness subscriber
    // must also see `actor` so any mirrored permission audit
    // consumer can distinguish overlay vs baseline.
    const harnessSide = harnessEvents.find(e => e.type === 'permission_granted');
    expect(harnessSide).toBeDefined();
    expect(harnessSide.id).toBe(granted.id);
    expect(harnessSide.actor).toEqual(actorA);
  });

  it('session-level grant emits event WITHOUT actor (preserves legacy shape)', async () => {
    const { session } = await setup();
    const events: any[] = [];
    session.subscribe(e => events.push(e));
    await session.permissions.grantTool({ toolName: 'shell.run' });
    const granted = events.find(e => e.type === 'permission_granted');
    expect(granted).toBeDefined();
    expect(granted.toolName).toBe('shell.run');
    expect(granted.actor).toBeUndefined();
  });

  it('two concurrent identical grants emit only one permission_granted (race-safe)', async () => {
    // CodeRabbit caught a race: two concurrent identical grantTool
    // calls both pass the outer pre-check, then the helper builds a
    // fresh map even on no-op, so the mutator emits twice. The fix
    // moves the dedupe inside `_flushUpdate` and gates emit on a
    // `changed` closure flag.
    const { session } = await setup();
    const actorA: HarnessActorIdentity = { kind: 'a2a', id: 'agent-A' };
    const events: any[] = [];
    session.subscribe(e => events.push(e));
    await Promise.all([
      session.permissions.grantTool({ toolName: 'shell.run', actor: actorA }),
      session.permissions.grantTool({ toolName: 'shell.run', actor: actorA }),
    ]);
    const granted = events.filter(e => e.type === 'permission_granted' && e.toolName === 'shell.run');
    expect(granted).toHaveLength(1);
  });

  it('two concurrent identical session-level grants emit only one permission_granted', async () => {
    const { session } = await setup();
    const events: any[] = [];
    session.subscribe(e => events.push(e));
    await Promise.all([
      session.permissions.grantTool({ toolName: 'shell.run' }),
      session.permissions.grantTool({ toolName: 'shell.run' }),
    ]);
    const granted = events.filter(e => e.type === 'permission_granted' && e.toolName === 'shell.run');
    expect(granted).toHaveLength(1);
    // Pre-existing race: the array also wouldn't double-append now
    // that dedupe runs under the serialized flush lane.
    expect(session.permissions.getGrants().tools).toEqual(['shell.run']);
  });

  it('revoke event carries actor identity', async () => {
    const { session } = await setup();
    const actorA: HarnessActorIdentity = { kind: 'a2a', id: 'agent-A' };
    await session.permissions.grantTool({ toolName: 'shell.run', actor: actorA });
    const events: any[] = [];
    session.subscribe(e => events.push(e));
    await session.permissions.revokeTool({ toolName: 'shell.run', actor: actorA });
    const revoked = events.find(e => e.type === 'permission_revoked');
    expect(revoked).toBeDefined();
    expect(revoked.actor).toEqual(actorA);
  });
});

describe('applyProfile clears actorGrants', () => {
  it('every per-actor overlay is dropped alongside the session-level reset', async () => {
    const { session } = await setup();
    const actorA: HarnessActorIdentity = { kind: 'a2a', id: 'agent-A' };
    await session.permissions.grantTool({ toolName: 'shell.run', actor: actorA });
    expect((session as any)._record.actorGrants?.['a2a:agent-A']).toBeDefined();

    await session.permissions.applyProfile({ profileName: 'readOnlyReview' });

    expect((session as any)._record.actorGrants).toBeUndefined();
    expect(session.permissions.getGrants({ actor: actorA }).tools).toEqual([]);
    // Session-level rules now from the profile.
    expect((session as any)._resolveToolPermissionPolicy('shell.run', { actor: actorA })).toBe('deny');
  });
});

describe('deriveActorFromChannel (wire-up helper)', () => {
  it('returns undefined when channel context is absent', async () => {
    const { _deriveActorFromChannelForTest } = await import('./session');
    expect(_deriveActorFromChannelForTest(undefined)).toBeUndefined();
  });

  it('returns undefined when platformUserId is missing', async () => {
    const { _deriveActorFromChannelForTest } = await import('./session');
    expect(
      _deriveActorFromChannelForTest({
        origin: 'inbound',
        harnessName: 'default',
        channelId: 'ch-1',
        providerId: 'slack',
        platform: 'slack',
        externalThreadId: 'TH1',
      } as any),
    ).toBeUndefined();
  });

  it('builds a composite key from provider/tenant/channel/platformUserId', async () => {
    const { _deriveActorFromChannelForTest } = await import('./session');
    const actor = _deriveActorFromChannelForTest({
      origin: 'inbound',
      harnessName: 'default',
      channelId: 'ch-1',
      providerId: 'slack',
      platform: 'slack',
      externalTenantId: 'T1',
      externalChannelId: 'C1',
      externalThreadId: 'TH1',
      actor: { platformUserId: 'U1', displayName: 'Alice' },
    } as any);
    expect(actor).toEqual({
      kind: 'channel',
      id: 'slack:T1:C1:U1',
      displayName: 'Alice',
    });
  });

  it('two Slack tenants on the same user id resolve to distinct keys (anti-collision)', async () => {
    const { _deriveActorFromChannelForTest } = await import('./session');
    const a = _deriveActorFromChannelForTest({
      origin: 'inbound',
      harnessName: 'default',
      channelId: 'ch-1',
      providerId: 'slack',
      platform: 'slack',
      externalTenantId: 'T-A',
      externalChannelId: 'C1',
      externalThreadId: 'TH1',
      actor: { platformUserId: 'U123' },
    } as any);
    const b = _deriveActorFromChannelForTest({
      origin: 'inbound',
      harnessName: 'default',
      channelId: 'ch-1',
      providerId: 'slack',
      platform: 'slack',
      externalTenantId: 'T-B',
      externalChannelId: 'C1',
      externalThreadId: 'TH1',
      actor: { platformUserId: 'U123' },
    } as any);
    expect(a?.id).not.toBe(b?.id);
  });
});

describe('legacy backward compat', () => {
  it('a session with no actorGrants resolves identically to pre-S2 behavior', async () => {
    const { session } = await setup();
    await session.permissions.grantTool({ toolName: 'shell.run' });
    expect((session as any)._resolveToolPermissionPolicy('shell.run')).toBe('allow');
    // No actor passed → falls through to session-level grants exactly
    // as before S2.
    expect((session as any)._record.actorGrants).toBeUndefined();
  });
});
