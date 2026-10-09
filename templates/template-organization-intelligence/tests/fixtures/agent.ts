import { createOrganizationAgent } from '../../src/mastra/agents/organization-agent.js';

/** Isolate single-turn answer tests from chat persistence. */
export function createStatelessOrganizationAgent(
  ...[index, model, options]: Parameters<typeof createOrganizationAgent>
) {
  return createOrganizationAgent(index, model, { ...options, memory: false });
}
