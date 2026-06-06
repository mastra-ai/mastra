import { automatedChatScenario } from './automated-chat.js';
import { branchContextLongNameScenario } from './branch-context-long-name.js';
import { integrationCommandsScenario } from './integration-commands.js';
import { reportIssueCommandScenario } from './report-issue-command.js';
import { startupScenario } from './startup.js';
import type { McE2eScenario, ScenarioName } from './types.js';
import { visibleCommandsScenario } from './visible-commands.js';

export type { McE2eScenario, McE2eScenarioRuntime, ScenarioName } from './types.js';

export const scenarios: Record<ScenarioName, McE2eScenario> = {
  startup: startupScenario,
  'branch-context-long-name': branchContextLongNameScenario,
  'automated-chat': automatedChatScenario,
  'visible-commands': visibleCommandsScenario,
  'integration-commands': integrationCommandsScenario,
  'report-issue-command': reportIssueCommandScenario,
};

export function getScenario(name: ScenarioName): McE2eScenario {
  return scenarios[name];
}

export function listScenarios(): McE2eScenario[] {
  return Object.values(scenarios);
}
