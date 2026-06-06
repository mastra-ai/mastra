import { apiKeyPromptScenario } from './api-key-prompt.js';
import { automatedChatScenario } from './automated-chat.js';
import { branchContextLongNameScenario } from './branch-context-long-name.js';
import { integrationCommandsScenario } from './integration-commands.js';
import { modalAndShellScenario } from './modal-and-shell.js';
import { reportIssueCommandScenario } from './report-issue-command.js';
import { startupScenario } from './startup.js';
import { stateCommandsScenario } from './state-commands.js';
import { storageSettingsScenario } from './storage-settings.js';
import type { McE2eScenario, ScenarioName } from './types.js';
import { visibleCommandsScenario } from './visible-commands.js';
import { workspaceCommandsScenario } from './workspace-commands.js';

export type { McE2eScenario, McE2eScenarioRuntime, ScenarioName } from './types.js';

export const scenarios: Record<ScenarioName, McE2eScenario> = {
  startup: startupScenario,
  'branch-context-long-name': branchContextLongNameScenario,
  'api-key-prompt': apiKeyPromptScenario,
  'automated-chat': automatedChatScenario,
  'visible-commands': visibleCommandsScenario,
  'integration-commands': integrationCommandsScenario,
  'modal-and-shell': modalAndShellScenario,
  'report-issue-command': reportIssueCommandScenario,
  'state-commands': stateCommandsScenario,
  'storage-settings': storageSettingsScenario,
  'workspace-commands': workspaceCommandsScenario,
};

export function getScenario(name: ScenarioName): McE2eScenario {
  return scenarios[name];
}

export function listScenarios(): McE2eScenario[] {
  return Object.values(scenarios);
}
