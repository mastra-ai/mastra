/**
 * Common test setup for harness v1 unit tests.
 *
 * Most tests want: an InMemory storage, a single MockAgent registered as
 * `'default'`, and a one-mode harness pointing at it. Anything richer
 * (multi-agent, transitions, multiple modes) accepts overrides.
 */

import { InMemoryHarness } from '../../../storage/domains/harness/inmemory';
import { InMemoryStore } from '../../../storage/mock';
import { Harness } from '../harness';
import type { HarnessConfig, HarnessMode } from '../types';

import { MockAgent } from './mock-agent';

export interface HarnessTestSetupOptions {
  /** Override agents map. Defaults to `{ default: new MockAgent({ id: 'default' }) }`. */
  agents?: Record<string, MockAgent>;
  /** Override modes. Defaults to a single `'default'` mode bound to `'default'` agent. */
  modes?: HarnessMode[];
  /** Override defaultModeId. Defaults to first mode's id. */
  defaultModeId?: string;
  /** Optional overrides forwarded to HarnessConfig.sessions. */
  sessions?: HarnessConfig['sessions'];
  /** Optional goal-loop defaults. */
  goals?: HarnessConfig['goals'];
  /** Optional workspace config (§2.7). */
  workspace?: HarnessConfig['workspace'];
  /** Optional subagent registry. */
  subagents?: HarnessConfig['subagents'];
  /** Optional default permission policy (§4.2e). */
  defaultPermissionPolicy?: HarnessConfig['defaultPermissionPolicy'];
  /** Optional tool-category resolver (§4.2e). */
  toolCategoryResolver?: HarnessConfig['toolCategoryResolver'];
  /** Optional model catalog (§9). */
  models?: HarnessConfig['models'];
  /** Optional code-registered skill catalog (§4.6/§9). */
  skills?: HarnessConfig['skills'];
  /** Optional model auth-status resolver (§9). */
  modelAuthStatusResolver?: HarnessConfig['modelAuthStatusResolver'];
}

export interface HarnessTestSetup {
  harness: Harness;
  agent: MockAgent;
  agents: Record<string, MockAgent>;
  storage: InMemoryHarness;
}

/**
 * Build a one-mode, one-agent in-memory harness for tests. Returned `agent`
 * is the `'default'` agent unless callers passed their own map (in which case
 * it's the first entry).
 */
export function setupHarness(opts: HarnessTestSetupOptions = {}): HarnessTestSetup {
  const agents = opts.agents ?? { default: new MockAgent({ id: 'default' }) };
  const modes: HarnessMode[] = opts.modes ?? [{ id: 'default', agentId: 'default' }];
  const compositeStorage = new InMemoryStore();
  const storage = (opts.sessions?.storage as InMemoryHarness | undefined) ?? (compositeStorage.stores.harness as InMemoryHarness);
  compositeStorage.stores.harness = storage;
  const { storage: _sessionStorage, ...sessionOverrides } = opts.sessions ?? {};
  const harness = new Harness({
    agents: agents as any,
    storage: compositeStorage,
    modes,
    defaultModeId: opts.defaultModeId ?? modes[0]!.id,
    ...(Object.keys(sessionOverrides).length > 0 ? { sessions: sessionOverrides } : {}),
    ...(opts.goals ? { goals: opts.goals } : {}),
    ...(opts.workspace ? { workspace: opts.workspace } : {}),
    ...(opts.subagents ? { subagents: opts.subagents } : {}),
    ...(opts.defaultPermissionPolicy ? { defaultPermissionPolicy: opts.defaultPermissionPolicy } : {}),
    ...(opts.toolCategoryResolver ? { toolCategoryResolver: opts.toolCategoryResolver } : {}),
    ...(opts.models ? { models: opts.models } : {}),
    ...(opts.skills ? { skills: opts.skills } : {}),
    ...(opts.modelAuthStatusResolver ? { modelAuthStatusResolver: opts.modelAuthStatusResolver } : {}),
  });
  const firstAgent = Object.values(agents)[0]!;
  return { harness, agent: firstAgent, agents, storage };
}
