/**
 * Common test setup for harness v1 unit tests.
 *
 * Most tests want: an InMemory storage, a single MockAgent registered as
 * `'default'`, and a one-mode harness pointing at it. Anything richer
 * (multi-agent, transitions, multiple modes) accepts overrides.
 */

import { InMemoryHarness } from '../../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../../storage/domains/inmemory-db';
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
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: agents as any,
    modes,
    defaultModeId: opts.defaultModeId ?? modes[0]!.id,
    sessions: { storage, ...(opts.sessions ?? {}) },
    ...(opts.goals ? { goals: opts.goals } : {}),
  });
  const firstAgent = Object.values(agents)[0]!;
  return { harness, agent: firstAgent, agents, storage };
}
