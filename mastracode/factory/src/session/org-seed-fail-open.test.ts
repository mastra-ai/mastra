import { getDynamicMemory } from '@mastra/code-sdk/agents/memory';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraFactory } from '../factory.js';
import { seedSessionOrg } from './org-seed.js';

/**
 * Wire regression for the org-classification fail-open (PR #21823 review):
 * a projectless Factory-hosted session whose org-state write REJECTS must
 * refuse knowledge capture, never fall through to the `local` org.
 *
 * The chain under test is real end to end: the Factory controller's actual
 * `initialState` (captured off the mocked SDK mount) -> session state built
 * the way `Session` builds it -> `seedSessionOrg` with a rejecting
 * `state.set` -> the REAL SDK classification in `getDynamicMemory` (deep
 * import; the bare-specifier mock below does not touch it). `@mastra/memory`
 * is NOT mocked — the sdk dist resolves its own (externalized) copy, so the
 * refusal is asserted through its two real observables: the deduped
 * "Knowledge capture disabled" error (fired iff capture is refused) and the
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

  it('refuses capture and never classifies as local when the org seed write rejects', async () => {
    // 1. The controller's REAL initialState, captured off the factory mount.
    const storage = new LibSQLFactoryStorage({ url: ':memory:', id: 'org-seed-fail-open-test' });
    const factory = new MastraFactory({ storage });
    await factory.prepare();
    expect(prepareMock).toHaveBeenCalledOnce();
    const capturedInitialState = (prepareMock.mock.calls[0]![0] as { initialState: Record<string, unknown> })
      .initialState;

    // 2. Session state as the controller builds it: schema defaults merged
    //    with the cloned initialState (session.ts merge order).
    const schemaDefaults: Record<string, unknown> = {};
    const sessionState = { ...schemaDefaults, ...structuredClone(capturedInitialState) };

    // 3. Tyler's exact scenario: a projectless session whose org-state write
    //    REJECTS. seedSessionOrg swallows the failure by contract, so the
    //    write leaves no trace in session state.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sessionDouble = {
      state: {
        get: () => sessionState,
        set: () => Promise.reject(new Error('session state write failed')),
      },
    };
    await seedSessionOrg(sessionDouble, undefined);
    warnSpy.mockRestore();

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

      // Capture refused: the fail-closed refusal is the ONLY path that emits
      // this error, and it is exactly the path where capture stays disabled
      // (`captureEnabled = subconsciousEnabled && !orgUnresolvedRefusal`).
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(String(errorSpy.mock.calls[0]?.[0])).toContain('Knowledge capture disabled');
      // And the session was never classified — in particular never as 'local'.
      expect(requestContext.set).not.toHaveBeenCalledWith('organizationId', expect.anything());
      expect(requestContext.get('organizationId')).toBeUndefined();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
