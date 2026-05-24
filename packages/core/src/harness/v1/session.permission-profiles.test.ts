/**
 * Harness v1 — permission profile tests.
 *
 *   - 4 named presets (readOnlyReview, approvalGatedPatch, ciFixer,
 *     trustedLocalYolo) populate every ToolCategory explicitly
 *   - applyProfile replaces permissionRules + sessionGrants (not merge)
 *   - applyProfile preserves caller denies when preserveCallerDenies: true
 *   - applyProfile emits permission_profile_applied on both session-level
 *     and harness-level subscribers
 *   - the resolved policy correctly gates `read` allowed / `edit` denied
 *     when readOnlyReview is applied, regardless of the harness
 *     `defaultPermissionPolicy`
 *   - harness.permissions.profiles.{get,list} surface
 *   - applyProfile against an unknown profile name throws the typed
 *     HarnessPermissionProfileNotFoundError
 */

import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { buildFakeOutput } from './__test-utils__/fake-output';

import type { HarnessEvent } from './events';
import { Harness } from './harness';
import { HARNESS_PERMISSION_PROFILES } from './permission-profiles';
import type { HarnessPermissionProfileName } from './permission-profiles';

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

async function setup(opts?: { defaultPermissionPolicy?: 'allow' | 'ask' | 'deny' }) {
  const agent = new FakeAgent('default');
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { default: agent } as any,
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: { storage },
    ...(opts?.defaultPermissionPolicy !== undefined ? { defaultPermissionPolicy: opts.defaultPermissionPolicy } : {}),
  });
  const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
  return { harness, session };
}

describe('HARNESS_PERMISSION_PROFILES — preset shape', () => {
  it('every preset populates every ToolCategory explicitly (anti-drift contract)', () => {
    // Critical invariant: each preset must declare a policy for read,
    // edit, execute, mcp, and other. Falling through to the harness
    // defaultPermissionPolicy would break readOnlyReview on a harness
    // configured with `defaultPermissionPolicy: 'allow'`.
    const required = ['read', 'edit', 'execute', 'mcp', 'other'];
    for (const profile of Object.values(HARNESS_PERMISSION_PROFILES)) {
      for (const category of required) {
        expect(profile.categories[category as keyof typeof profile.categories]).toBeDefined();
      }
    }
  });

  it('readOnlyReview allows read and denies every other category', () => {
    const p = HARNESS_PERMISSION_PROFILES.readOnlyReview;
    expect(p.categories.read).toBe('allow');
    expect(p.categories.edit).toBe('deny');
    expect(p.categories.execute).toBe('deny');
    expect(p.categories.mcp).toBe('deny');
    expect(p.categories.other).toBe('deny');
    expect(p.tags).toContain('remote-safe');
  });

  it('approvalGatedPatch asks for edit/execute/mcp/other, grants read', () => {
    const p = HARNESS_PERMISSION_PROFILES.approvalGatedPatch;
    expect(p.categories.read).toBe('allow');
    expect(p.categories.edit).toBe('ask');
    expect(p.categories.execute).toBe('ask');
    expect(p.grants.categories).toContain('read');
  });

  it('trustedLocalYolo allows everything and is tagged local-only', () => {
    const p = HARNESS_PERMISSION_PROFILES.trustedLocalYolo;
    for (const cat of ['read', 'edit', 'execute', 'mcp', 'other'] as const) {
      expect(p.categories[cat]).toBe('allow');
    }
    expect(p.tags).toContain('local-only');
    expect(p.tags).not.toContain('remote-safe');
  });
});

describe('session.permissions.applyProfile', () => {
  it('replaces permissionRules.categories and sessionGrants on the session record', async () => {
    const { session } = await setup();
    await session.permissions.setPolicy({ category: 'execute', policy: 'allow' });
    await session.permissions.applyProfile({ profileName: 'readOnlyReview' });
    const rules = session.permissions.getRules();
    expect(rules.categories.execute).toBe('deny');
    expect(rules.categories.read).toBe('allow');
    const grants = session.permissions.getGrants();
    expect(grants.categories).toEqual([]);
    expect(grants.tools).toEqual([]);
  });

  it('preserves caller-set tool denies when preserveCallerDenies: true', async () => {
    const { session } = await setup();
    await session.permissions.setPolicy({ toolName: 'rm_rf', policy: 'deny' });
    await session.permissions.applyProfile({
      profileName: 'trustedLocalYolo',
      preserveCallerDenies: true,
    });
    const rules = session.permissions.getRules();
    expect(rules.tools.rm_rf).toBe('deny');
    expect(rules.categories.execute).toBe('allow');
  });

  it('does NOT preserve caller denies in default replace mode', async () => {
    const { session } = await setup();
    await session.permissions.setPolicy({ toolName: 'rm_rf', policy: 'deny' });
    await session.permissions.applyProfile({ profileName: 'trustedLocalYolo' });
    const rules = session.permissions.getRules();
    expect(rules.tools.rm_rf).toBeUndefined();
  });

  it('emits permission_profile_applied on session AND harness subscribers', async () => {
    const { harness, session } = await setup();
    const sessionEvents: HarnessEvent[] = [];
    const harnessEvents: HarnessEvent[] = [];
    session.subscribe(e => sessionEvents.push(e));
    harness.subscribe(e => harnessEvents.push(e));
    await session.permissions.applyProfile({ profileName: 'readOnlyReview' });
    const sessionEvent = sessionEvents.find(e => e.type === 'permission_profile_applied') as any;
    const harnessEvent = harnessEvents.find(e => e.type === 'permission_profile_applied') as any;
    expect(sessionEvent).toBeDefined();
    expect(harnessEvent).toBeDefined();
    expect(sessionEvent.profileName).toBe('readOnlyReview');
    expect(sessionEvent.mode).toBe('replace');
    expect(sessionEvent.categories.edit).toBe('deny');
    expect(harnessEvent.id).toBe(sessionEvent.id);
  });

  it('event records previousProfileName when overwriting an earlier apply', async () => {
    const { session } = await setup();
    const events: HarnessEvent[] = [];
    session.subscribe(e => events.push(e));
    await session.permissions.applyProfile({ profileName: 'approvalGatedPatch' });
    await session.permissions.applyProfile({ profileName: 'readOnlyReview' });
    const applies = events.filter(e => e.type === 'permission_profile_applied') as any[];
    expect(applies).toHaveLength(2);
    expect(applies[0].previousProfileName).toBeUndefined();
    expect(applies[1].previousProfileName).toBe('approvalGatedPatch');
  });

  it('preserves a deny from a concurrent setPolicy whose flush has not yet run when applyProfile starts', async () => {
    // Race contract: when setPolicy is queued AHEAD of applyProfile in
    // the serialized flush lane, applyProfile must derive its
    // preserveCallerDenies snapshot from the SAME `prev` the flush
    // sees — not from a synchronous `this._record` read taken before
    // the queued setPolicy ran. The earlier implementation captured
    // `this._record` synchronously above the await, so this
    // call order would have dropped the rm_rf deny:
    //   setPolicy(deny) queued first → flush runs, deny lands →
    //   applyProfile.flush runs second with a pre-captured `nextRules`
    //   computed from the pre-setPolicy snapshot → overwrites the deny.
    // The fix is to compute everything inside the `_flushUpdate`
    // callback so `prev` is the post-setPolicy record.
    const { session } = await setup();
    const denyPromise = session.permissions.setPolicy({ toolName: 'rm_rf', policy: 'deny' });
    const profilePromise = session.permissions.applyProfile({
      profileName: 'trustedLocalYolo',
      preserveCallerDenies: true,
    });
    await Promise.all([denyPromise, profilePromise]);
    const rules = session.permissions.getRules();
    expect(rules.tools.rm_rf).toBe('deny');
    expect(rules.categories.execute).toBe('allow');
  });

  it('rejects an unknown profile name with HarnessPermissionProfileNotFoundError', async () => {
    const { session } = await setup();
    await expect(
      session.permissions.applyProfile({
        profileName: 'no-such-profile' as HarnessPermissionProfileName,
      }),
    ).rejects.toMatchObject({
      name: 'HarnessPermissionProfileNotFoundError',
      code: 'harness.permission_profile_not_found',
    });
  });
});

describe('applyProfile — resolution semantics', () => {
  it('readOnlyReview denies edit even when harness defaultPermissionPolicy is allow', async () => {
    // Critical anti-drift assertion. Verifies that the profile's
    // explicit category populating wins over the harness default,
    // because applyProfile writes every category into
    // permissionRules.categories — the resolution path
    // (session._resolveToolPermissionPolicy) never falls through to
    // _getDefaultPermissionPolicy() for a category the profile
    // declared.
    const { session, harness } = await setup({ defaultPermissionPolicy: 'allow' });
    await session.permissions.applyProfile({ profileName: 'readOnlyReview' });
    expect(harness._getDefaultPermissionPolicy()).toBe('allow');
    expect((session as any)._resolveToolPermissionPolicy('any.edit.tool')).toBe('allow'); // category unknown
    // Tools whose category resolves to 'edit' must be denied.
    expect(
      (session as any)._resolveToolPermissionPolicy.call(
        Object.create(session, {
          _harness: { value: Object.create(harness, { getToolCategory: { value: () => 'edit' } }) },
        }),
        'tool',
      ),
    ).toBe('deny');
  });

  it('trustedLocalYolo grants every category so a tool resolves to allow even when rules say ask', async () => {
    // session grants suppress 'ask' to 'allow'. Verify the
    // trustedLocalYolo grants cover every category.
    const { harness, session } = await setup();
    await session.permissions.applyProfile({ profileName: 'trustedLocalYolo' });
    const grants = session.permissions.getGrants();
    for (const cat of ['read', 'edit', 'execute', 'mcp', 'other']) {
      expect(grants.categories).toContain(cat);
    }
    expect(harness._getDefaultPermissionPolicy()).toBe('ask');
  });
});

describe('harness.permissions.profiles', () => {
  it('get returns the named profile', async () => {
    const { harness } = await setup();
    expect(harness.permissions.profiles.get('readOnlyReview')?.name).toBe('readOnlyReview');
  });

  it('list returns all 4 presets', async () => {
    const { harness } = await setup();
    const names = harness.permissions.profiles.list().map(p => p.name);
    expect(names).toEqual(
      expect.arrayContaining(['readOnlyReview', 'approvalGatedPatch', 'ciFixer', 'trustedLocalYolo']),
    );
    expect(names).toHaveLength(4);
  });

  it('harness.permissions.applyProfile delegates to the session-level surface', async () => {
    const { harness, session } = await setup();
    await harness.permissions.applyProfile({
      sessionId: session.id,
      resourceId: session.resourceId,
      profileName: 'readOnlyReview',
    });
    const rules = session.permissions.getRules();
    expect(rules.categories.edit).toBe('deny');
  });
});
