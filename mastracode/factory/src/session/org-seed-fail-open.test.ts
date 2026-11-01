import { resolveKnowledgeSessionScopes } from '@mastra/code-sdk/knowledge-scope';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraFactory } from '../factory.js';
import { seedSessionOrg } from './org-seed.js';

/**
 * Wire regression for the org-classification fail-open (PR #21823 review):
 * a projectless Factory-hosted session whose org-state write REJECTS must
 * leave its Knowledge session unresolved, never fall through to the `local` org.
 *
 * The chain under test is real end to end: the Factory controller's actual
 * `initialState` (captured off the mocked SDK mount) -> session state built
 * the way `Session` builds it -> `seedSessionOrg` with a rejecting
 * `state.set` -> the REAL SDK session-scope resolver the code agent and the
 * /knowledge inspector share (deep import; the bare-specifier mock below does
 * not touch it). An unresolved session gives the agent only identity tags and
 * makes the inspector unavailable, so it can never write under `org:local`.
 *
 * Without `factoryOrgUnresolved: true` in the controller's `initialState`,
 * the failed seed leaves neither marker and classification falls to `local`.
 */

// Bare-specifier mock: captures the controller mount config. Does NOT
// intercept the deep import `@mastra/code-sdk/knowledge-scope` (vitest mocks by
// specifier), so `resolveKnowledgeSessionScopes` stays real — which is the point.
const prepareMock = vi.fn(async (config: Record<string, unknown>) => ({
  base: { controller: { onSessionCreated: vi.fn(), setChannels: vi.fn() } },
  mastraArgs: {},
  finalize: vi.fn(async () => {}),
}));

vi.mock('@mastra/code-sdk', () => ({
  prepareAgentControllerMount: (config: Record<string, unknown>) => prepareMock(config),
}));

describe('org-classification fail-open (projectless factory session, rejecting org-state write)', () => {
  beforeEach(() => {
    prepareMock.mockClear();
  });

  it('leaves the Knowledge session unresolved, never org:local, when the org seed write rejects', async () => {
    // 1. The controller's REAL initialState, captured off the factory mount.
    const storage = new LibSQLFactoryStorage({ url: ':memory:', id: 'org-seed-fail-open-test' });
    const factory = new MastraFactory({ storage });
    await factory.prepare();
    expect(prepareMock).toHaveBeenCalledOnce();
    const capturedInitialState = (prepareMock.mock.calls[0]![0] as { initialState: Record<string, unknown> })
      .initialState;

    // 2. Session state as the controller builds it: the cloned initialState.
    //    `factoryOrgUnresolved` is declared optional with NO schema default
    //    (sdk/src/schema.ts), so the schema merge cannot clobber the value.
    const sessionState = { ...structuredClone(capturedInitialState) };

    // 3. A projectless session whose org-state write REJECTS. Without the
    //    fail-closed default, seedSessionOrg attempts to write the unresolved
    //    marker, the write rejects, is swallowed by contract, and the state
    //    stays unmarked — the exact fail-open. With the default present, the
    //    marker is already true and seedSessionOrg short-circuits without
    //    writing, which the `stateSet` assertion below pins.
    const stateSet = vi.fn(() => Promise.reject(new Error('session state write failed')));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await seedSessionOrg({ state: { get: () => sessionState, set: stateSet } }, undefined);
    } finally {
      warnSpy.mockRestore();
    }

    // 4. The real SDK session-scope resolver over that state: unresolved, and never `org:local`.
    const session = resolveKnowledgeSessionScopes(sessionState as never);
    expect(session).toEqual({ resolved: false, reason: 'This Factory session has no resolved organization.' });
    // Fail-closed default present -> the seed short-circuits and never
    // needs the (rejecting) write. Without the default, the write IS
    // attempted (and rejects) — so this also reddens on the base.
    expect(stateSet).not.toHaveBeenCalled();
  });
});
