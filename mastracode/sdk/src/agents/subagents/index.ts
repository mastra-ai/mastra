import type { AgentControllerSubagent } from '@mastra/core/agent-controller';
import { executeSubagent } from './execute.js';
import { exploreSubagent } from './explore.js';
import { planSubagent } from './plan.js';

/** The explore/plan/execute subagents. Not registered unless passed as `subagents`. */
export const builtinSubagents: readonly AgentControllerSubagent[] = [exploreSubagent, planSubagent, executeSubagent];

/** Subagents for the `preferences.subagentsEnabled` setting: the built-ins when on, none when off. */
export function resolveSubagentsSetting(enabled: boolean): AgentControllerSubagent[] {
  return enabled ? [...builtinSubagents] : [];
}
