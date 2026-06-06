import { automatedChatScenario } from './automated-chat.js';
import { branchContextLongNameScenario } from './branch-context-long-name.js';
import { startupScenario } from './startup.js';
import type { McE2eScenario, ScenarioName } from './types.js';

export type { McE2eScenario, McE2eScenarioRuntime, ScenarioName } from './types.js';

export const scenarios: Record<ScenarioName, McE2eScenario> = {
  startup: startupScenario,
  'branch-context-long-name': branchContextLongNameScenario,
  'automated-chat': automatedChatScenario,
};

export function getScenario(name: ScenarioName): McE2eScenario {
  return scenarios[name];
}

export function listScenarios(): McE2eScenario[] {
  return Object.values(scenarios);
}
