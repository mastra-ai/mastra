import { getDynamicMemory } from '@mastra/code-sdk/agents/memory';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraFactory } from '../factory.js';
import { seedSessionOrg } from './org-seed.js';

/**
 * Wire regression for the org-classification fail-open (PR #21823 review):
 * a projectless Factory-hosted session whose org-state write REJECTS must
 * refuse knowledge curation, never fall through to the `local` org.
 *
 * The chain under test is real end to end: the Factory controller's actual
 * `initialState` (captured off the mocked SDK mount) -> session state built
 * the way `Session` builds it -> `seedSessionOrg` with a rejecting
 * `state.set` -> the REAL SDK classification in `getDynamicMemory` (deep
 * import; the bare-specifier mock below does not touch it). `@mastra/memory`
 * is NOT mocked — the sdk dist resolves its own (externalized) copy, so the
 * refusal is asserted through its two real observables: the deduped
 * "Knowledge curation disabled" error (fired iff curation is refused) and the
 * request context never being classified.
 *
 * Without `factoryOrgUnresolved: true` in the controller's `initialState`,
 * the failed seed leaves neither marker and classification falls to `local`.
 */

// Bare-specifier mock: captures the controller mount config. Does NOT
// intercept the deep import `@mastra/code-sdk/agents/memory` (vitest mocks by
// specifier), so `getDynamicMemory` stays real — which is the point.
const prepareMock = vi.fn(async (config: Record<string, unknown>) => ({
  base: { controller: { onSessionCreated: vi.fn(), setChannels: vi.fn() } },
  mastraArgs: {},
  finalize: vi.fn(async () => {}),
}));

vi.mock('@mastra/code-sdk', () => ({
  prepareAgentControllerMount: (config: Record<string, unknown>) => prepareMock(config),
}));

describe('org-classification fail-open (projectless factory session, rejecting org-state write)', () => {
  const envBefore = process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS;

  beforeEach(() => {
    prepareMock.mockClear();
    process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS = '1';
  });

  afterEach(() => {
    if (envBefore === undefined) delete process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS;
    else process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS = envBefore;
  });

  it('refuses curation and never classifies as local when the org seed write rejects', async () => {
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

    // 4. The real SDK classification over that state.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const getState = () => sessionState;
      const values = new Map<string, unknown>([
        [
          'controller',
          {
            getState,
            session: { id: 'session-fail-open', ownerId: 'factory-controller', state: { get: getState } },
          },
        ],
      ]);
      const requestContext = {
        get: vi.fn((key: string) => values.get(key)),
        set: vi.fn((key: string, value: unknown) => values.set(key, value)),
      };

      getDynamicMemory(
        { storage: true } as never,
        { vector: true } as never,
      )({ requestContext: requestContext as never });

      // Curation refused: the fail-closed refusal is the ONLY path that emits
      // this error, and it is exactly the path where Subconscious stays disabled.
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(String(errorSpy.mock.calls[0]?.[0])).toContain('Knowledge curation disabled');
      // And the session was never classified — in particular never as 'local'.
      expect(requestContext.set).not.toHaveBeenCalledWith('organizationId', expect.anything());
      expect(requestContext.get('organizationId')).toBeUndefined();
      // Fail-closed default present -> the seed short-circuits and never
      // needs the (rejecting) write. Without the default, the write IS
      // attempted (and rejects) — so this also reddens on the base.
      expect(stateSet).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
