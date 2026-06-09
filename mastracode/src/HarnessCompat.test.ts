import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRealV1Harness } from './test-utils/real-v1-harness.js';

// The legacy `@mastra/core/harness` base class is mocked to a thin routing
// double on purpose: it is the layer being deleted in Step 6, and these tests
// assert the compat *routing* contract (which legacy methods HarnessCompat
// calls). The v1 *session* — the half this migration cares about — is REAL
// (built by createRealV1Harness over LibSQL), so session ownership, model/mode
// switching, persistence, and the no-drift invariant are proven against the
// genuine Harness v1, not a stub.
let legacyState: Record<string, unknown>;
let legacySetState: ReturnType<typeof vi.fn<(updates: Record<string, unknown>) => void>>;
let legacySwitchThread: ReturnType<typeof vi.fn<(opts: unknown) => void>>;
let legacySwitchMode: ReturnType<typeof vi.fn<(opts: unknown) => void>>;
let legacySetThreadSetting: ReturnType<typeof vi.fn<(opts: unknown) => void>>;
let legacyListModes: ReturnType<typeof vi.fn<() => unknown[]>>;

vi.mock('@mastra/core/harness', () => ({
  Harness: class {
    constructor(_args: unknown) {
      void (this as { setState: (updates: Record<string, unknown>) => Promise<void> }).setState({
        currentModelId: 'constructor-model',
      });
    }

    getState() {
      return legacyState;
    }

    setState(updates: Record<string, unknown>) {
      legacySetState(updates);
      legacyState = { ...legacyState, ...updates };
      return Promise.resolve();
    }

    switchThread(opts: unknown) {
      legacySwitchThread(opts);
      return Promise.resolve();
    }

    switchMode(opts: { modeId: string }) {
      legacySwitchMode(opts);
      legacyState = { ...legacyState, currentModeId: opts.modeId };
      return Promise.resolve();
    }

    setThreadSetting(opts: unknown) {
      legacySetThreadSetting(opts);
      return Promise.resolve();
    }

    getSubagentModelId({ agentType }: { agentType?: string } = {}) {
      if (agentType) {
        const perType = legacyState[`subagentModelId_${agentType}`];
        if (typeof perType === 'string') return perType;
      }
      const global = legacyState.subagentModelId;
      return typeof global === 'string' ? global : null;
    }

    async setSubagentModelId({ modelId, agentType }: { modelId: string; agentType?: string }) {
      const key = agentType ? `subagentModelId_${agentType}` : 'subagentModelId';
      await this.setState({ [key]: modelId });
      await this.setThreadSetting({ key, value: modelId });
    }

    getResourceId() {
      return 'resource-id';
    }

    listModes() {
      return legacyListModes();
    }
  },
}));

// Real v1 modes. `build` is default; `plan` exists so mode switches resolve
// against a genuine registered mode on the real harness.
const v1Modes = [
  { id: 'build', defaultModelId: 'default-model', metadata: { agentId: 'agent' } },
  { id: 'plan', defaultModelId: 'plan-model', metadata: { agentId: 'agent' } },
];

const cleanups: Array<() => void> = [];

/**
 * Build a HarnessCompat backed by a REAL v1 harness. The v1 harness is created
 * over LibSQL; we pre-create the session for `threadId` and seed its durable
 * model so tests can assert resume/ownership behavior against real persistence.
 */
async function createCompat(opts: { threadId: string; sessionModelId?: string } = { threadId: 'thread-id' }) {
  const { HarnessCompat } = await import('./HarnessCompat.js');
  const { harness: harnessV1, cleanup } = createRealV1Harness<Record<string, unknown>>({
    modes: v1Modes,
    defaultModeId: 'build',
    initialState: { projectPath: '/session-repo' },
  });
  cleanups.push(cleanup);
  await harnessV1.init();

  // Seed the session's durable model so switchThread adopts it (real durability).
  // Creating the session with an explicit `modelId` writes it into the initial
  // SessionRecord via an awaited `saveSession`, so the durable model is
  // committed deterministically before HarnessCompat reloads the thread.
  if (opts.sessionModelId) {
    await harnessV1.session({ threadId: opts.threadId, resourceId: 'resource-id', modelId: opts.sessionModelId });
  }

  const harness = new HarnessCompat({} as never, harnessV1 as never);
  return { harness, harnessV1 };
}

describe('HarnessCompat session-derived state', () => {
  beforeEach(() => {
    legacyState = { projectPath: '/repo', subagentModelId_worker: 'worker-model' };
    legacySetState = vi.fn();
    legacySwitchThread = vi.fn();
    legacySwitchMode = vi.fn();
    legacySetThreadSetting = vi.fn();
    legacyListModes = vi.fn(() => []);
  });

  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  });

  it('composes model and mode from the active session', async () => {
    const { harness } = await createCompat({ threadId: 'thread-id', sessionModelId: 'session-model' });
    await harness.switchThread({ threadId: 'thread-id' });

    // Legacy state remains the single state owner; the session contributes
    // only its identity fields (model + mode), read from the REAL session.
    expect(harness.getState()).toMatchObject({
      currentModelId: 'session-model',
      modeId: 'build',
    });
    expect(legacySwitchThread).toHaveBeenCalledWith({ threadId: 'thread-id' });
  });

  it('makes the session authoritative for the model when switching threads', async () => {
    // The second thread's real session has a durable model; switching to it must
    // adopt that model rather than clobbering it with the previously selected one.
    const { harness, harnessV1 } = await createCompat({ threadId: 'first-thread' });
    await harnessV1.session({ threadId: 'second-thread', resourceId: 'resource-id', modelId: 'stored-thread-model' });

    await harness.switchThread({ threadId: 'first-thread' });
    await harness.switchThread({ threadId: 'second-thread' });

    // Step 2: the real v1 session owns the model; legacy read-through reconciles.
    expect(harness.getState()).toMatchObject({ currentModelId: 'stored-thread-model' });
  });

  it('routes session-derived setState fields to the session and harness fields to legacy state', async () => {
    const { harness } = await createCompat({ threadId: 'thread-id' });
    await harness.switchThread({ threadId: 'thread-id' });

    await harness.setState({
      currentModelId: 'new-session-model',
      modeId: 'plan',
      projectPath: '/new-repo',
    } as never);

    // The REAL session now owns the new identity values. Read them through the
    // compat's authoritative in-memory session (via getState) so the assertion
    // does not race the session's fire-and-forget durability writes.
    expect(harness.getState()).toMatchObject({ currentModelId: 'new-session-model', modeId: 'plan' });
    expect(legacySwitchMode).toHaveBeenCalledWith({ modeId: 'plan' });
    // Legacy receives harness state plus the identity mirror so its direct
    // `this.state` reads stay in sync with the authoritative session.
    expect(legacySetState).toHaveBeenCalledWith({
      projectPath: '/new-repo',
      currentModelId: 'new-session-model',
    });
    expect(harness.getState()).toMatchObject({
      projectPath: '/new-repo',
      currentModelId: 'new-session-model',
      modeId: 'plan',
    });
  });

  it('keeps legacy read-through in sync with the authoritative session across every write path (no drift)', async () => {
    const { harness } = await createCompat({ threadId: 'thread-a', sessionModelId: 'thread-a-model' });

    // Invariant: legacy `this.state` (what legacy internals read directly) must
    // always agree with the authoritative REAL v1 session. Identity is read
    // through `harness.getState()`, which reflects the compat's live in-memory
    // session (the single owner) without racing fire-and-forget durability.
    const assertNoDrift = (expectedModelId: string, expectedModeId: string) => {
      expect(legacyState.currentModelId).toBe(expectedModelId);
      expect(harness.getState()).toMatchObject({ currentModelId: expectedModelId, modeId: expectedModeId });
    };

    // 1. Attach via switchThread: session's durable model wins, legacy follows.
    await harness.switchThread({ threadId: 'thread-a' });
    assertNoDrift('thread-a-model', 'build');

    // 2. Model change via setState: session is written, legacy mirrors.
    await harness.setState({ currentModelId: 'picked-model' } as never);
    assertNoDrift('picked-model', 'build');

    // 3. Mode change via setState→switchMode: session mode flips, legacy follows.
    await harness.setState({ modeId: 'plan' } as never);
    assertNoDrift('picked-model', 'plan');

    // 4. Direct switchMode entry point: same invariant holds.
    await harness.switchMode({ modeId: 'build' });
    assertNoDrift('picked-model', 'build');

    // 5. Combined write: identity + harness state in one setState call.
    await harness.setState({ currentModelId: 'combo-model', projectPath: '/combo' } as never);
    assertNoDrift('combo-model', 'build');
  });

  it('keeps per-agent subagent model overrides in harness state', async () => {
    const { harness } = await createCompat({ threadId: 'thread-id' });
    await harness.switchThread({ threadId: 'thread-id' });

    expect(harness.getSubagentModelId({ agentType: 'worker' })).toBe('worker-model');
    expect(harness.getSubagentModelId()).toBeNull();

    await harness.setSubagentModelId({ modelId: 'default-subagent-model' });

    expect(legacySetState).toHaveBeenCalledWith({ subagentModelId: 'default-subagent-model' });
    expect(harness.getSubagentModelId()).toBe('default-subagent-model');
  });
});
