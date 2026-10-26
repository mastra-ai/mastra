import { CODE_AGENT_ID } from '@mastra/code-sdk/constants';

/**
 * The agents a phase's `runner.agentId` may name: those backing Factory's controller. Factory runs
 * that controller with modes and subagents off, so its code agent is the only one.
 */
export const FACTORY_AGENTS: readonly { readonly id: string; readonly name: string }[] = [
  { id: CODE_AGENT_ID, name: 'Code Agent' },
];

export const FACTORY_AGENT_IDS: ReadonlySet<string> = new Set(FACTORY_AGENTS.map(agent => agent.id));

export { CODE_AGENT_ID };
