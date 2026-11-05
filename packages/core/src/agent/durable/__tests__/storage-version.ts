import type { DurableAgent } from '../durable-agent';

/**
 * Sets whether `agent` stores its new runs in workflow storage v2. Call it
 * before registering the agent with Mastra, which builds the agent's workflow.
 *
 * Tests that read what a run writes through v1's methods pin v1 with this, so
 * they keep testing something when the durable suites run on the other
 * version (the `durable-other-storage-version` Vitest project).
 */
export function storeRunsInV2<A extends DurableAgent>(agent: A, value: boolean): A {
  Object.defineProperty(agent, 'storesRunsInJournal', { get: () => value, configurable: true });
  return agent;
}
