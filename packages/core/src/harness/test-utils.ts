import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';
import type { Session } from './session';
import type { HarnessConfig, HarnessMode } from './types';

/**
 * Shared test helpers for the Harness/Session suites.
 *
 * Every harness test needs the same boilerplate: an Agent, a default mode, a
 * storage backend, then `init()` + `createSession()`. These helpers collapse
 * that into a single call so individual tests only specify what they actually
 * care about (storage, subagents, omConfig, initialState, a custom agent, ...).
 */

export function createTestAgent(overrides?: Partial<ConstructorParameters<typeof Agent>[0]>): Agent<any, any, any, any> {
  return new Agent({
    id: 'test-agent',
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
    ...(overrides as any),
  });
}

export type TestHarnessConfig<TState = {}> = Partial<HarnessConfig<TState>> & {
  /** Backing agent for the default mode. Ignored if `modes` is provided. */
  agent?: Agent<any, any, any, any>;
};

/**
 * Construct a Harness wired with a single default mode and an in-memory store.
 * Any field in {@link HarnessConfig} can be overridden; pass `agent` to swap the
 * backing agent of the auto-generated default mode, or `modes` to take over the
 * mode list entirely.
 */
export function createTestHarness<TState = {}>(config: TestHarnessConfig<TState> = {}): Harness<TState> {
  const { agent, modes, storage, id, ...rest } = config;

  const defaultModes: HarnessMode[] = [
    { id: 'default', name: 'Default', default: true, agent: agent ?? createTestAgent() },
  ];

  return new Harness<TState>({
    id: id ?? 'test-harness',
    storage: storage ?? new InMemoryStore(),
    modes: modes ?? defaultModes,
    ...rest,
  } as HarnessConfig<TState>);
}

/**
 * Construct a Harness, bring up its shared resources, and mint a single Session
 * — the standard entry point for harness tests after the multi-session refactor.
 * Returns both so tests can reach harness-level machinery and the session.
 */
export async function createTestSession<TState = {}>(
  config: TestHarnessConfig<TState> = {},
): Promise<{ harness: Harness<TState>; session: Session<TState> }> {
  const harness = createTestHarness<TState>(config);
  await harness.init();
  const session = await harness.createSession();
  return { harness, session };
}
