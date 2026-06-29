import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Workspace } from '../workspace/workspace';
import { AgentController } from './agent-controller';
import type { Session } from './session';
import type { AgentControllerConfig, AgentControllerMode } from './types';

/**
 * Create a minimal Workspace instance for testing.
 * Uses a skills-only config so init() is a no-op (no fs/sandbox/search engine).
 */
export function createMockWorkspace(name = 'test-workspace'): Workspace {
  return new Workspace({ name, skills: ['/tmp/test-skills'] });
}

/**
 * Shared test helpers for the AgentController/Session suites.
 *
 * Every controller test needs the same boilerplate: an Agent, a default mode, a
 * storage backend, then `init()` + `createSession()`. These helpers collapse
 * that into a single call so individual tests only specify what they actually
 * care about (storage, subagents, omConfig, initialState, a custom agent, ...).
 */

export function createTestAgent(
  overrides?: Partial<ConstructorParameters<typeof Agent>[0]>,
): Agent<any, any, any, any> {
  return new Agent({
    id: 'test-agent',
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
    ...(overrides as any),
  });
}

export type TestControllerConfig<TState = {}> = Partial<AgentControllerConfig<TState>> & {
  /** Backing agent for the default mode. Ignored if `modes` is provided. */
  agent?: Agent<any, any, any, any>;
};

/**
 * Construct an AgentController wired with a single default mode and an in-memory store.
 * Any field in {@link AgentControllerConfig} can be overridden; pass `agent` to swap the
 * backing agent of the auto-generated default mode, or `modes` to take over the
 * mode list entirely.
 */
export function createTestController<TState = {}>(config: TestControllerConfig<TState> = {}): AgentController<TState> {
  const { agent, modes, storage, id, workspace, ...rest } = config;

  const defaultModes: AgentControllerMode[] = [
    { id: 'default', name: 'Default', default: true, agent: agent ?? createTestAgent() },
  ];

  return new AgentController<TState>({
    id: id ?? 'test-controller',
    storage: storage ?? new InMemoryStore(),
    modes: modes ?? defaultModes,
    workspace: workspace ?? createMockWorkspace(),
    ...rest,
  } as AgentControllerConfig<TState>);
}

/**
 * Construct an AgentController, bring up its shared resources, and mint a single Session
 * — the standard entry point for controller tests after the multi-session refactor.
 * Returns both so tests can reach controller-level machinery and the session.
 */
export async function createTestSession<TState = {}>(
  config: TestControllerConfig<TState> = {},
): Promise<{ controller: AgentController<TState>; session: Session<TState> }> {
  const controller = createTestController<TState>(config);
  await controller.init();
  const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
  return { controller, session };
}
