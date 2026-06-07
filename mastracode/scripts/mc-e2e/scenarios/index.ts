import { activeSignalFollowupScenario } from './active-signal-followup.js';
import { apiKeyPromptScenario } from './api-key-prompt.js';
import { automatedChatScenario } from './automated-chat.js';
import { branchContextLongNameScenario } from './branch-context-long-name.js';
import { clipboardImagePasteScenario } from './clipboard-image-paste.js';
import { customConfigDirScenario } from './custom-config-dir.js';
import { customProviderManagementScenario } from './custom-provider-management.js';
import { customSlashCommandScenario } from './custom-slash-command.js';
import { fileAutocompleteScenario } from './file-autocomplete.js';
import { firstRunOnboardingScenario } from './first-run-onboarding.js';
import { githubSignalsCommandScenario } from './github-signals-command.js';
import { integrationCommandsScenario } from './integration-commands.js';
import { mcpServerConfigScenario } from './mcp-server-config.js';
import { modalAndShellScenario } from './modal-and-shell.js';
import { notificationSignalRenderingScenario } from './notification-signal-rendering.js';
import { omSettingsScenario } from './om-settings.js';
import { openaiStrictSchemaScenario } from './openai-strict-schema.js';
import { processShortcutsScenario } from './process-shortcuts.js';
import { promptContextInstructionsScenario } from './prompt-context-instructions.js';
import { providerHistoryCompatScenario } from './provider-history-compat.js';
import { quietSettingsScenario } from './quiet-settings.js';
import { reportIssueCommandScenario } from './report-issue-command.js';
import { startupScenario } from './startup.js';
import { stateCommandsScenario } from './state-commands.js';
import { stateSignalRenderingScenario } from './state-signal-rendering.js';
import { storageSettingsScenario } from './storage-settings.js';
import { streamErrorRetryScenario } from './stream-error-retry.js';
import { streamingToolArgsScenario } from './streaming-tool-args.js';
import { taskProgressEventsScenario } from './task-progress-events.js';
import { threadHistoryScenario } from './thread-history.js';
import { toolSchemaCompatScenario } from './tool-schema-compat.js';
import type { McE2eScenario, ScenarioName } from './types.js';
import { updateCommandPromptScenario } from './update-command-prompt.js';
import { visibleCommandsScenario } from './visible-commands.js';
import { workspaceCommandsScenario } from './workspace-commands.js';
import { workspaceToolNamesScenario } from './workspace-tool-names.js';

export type { McE2eScenario, McE2eScenarioRuntime, ScenarioName } from './types.js';

export const scenarios: Record<ScenarioName, McE2eScenario> = {
  startup: startupScenario,
  'branch-context-long-name': branchContextLongNameScenario,
  'active-signal-followup': activeSignalFollowupScenario,
  'api-key-prompt': apiKeyPromptScenario,
  'automated-chat': automatedChatScenario,
  'clipboard-image-paste': clipboardImagePasteScenario,
  'custom-config-dir': customConfigDirScenario,
  'custom-provider-management': customProviderManagementScenario,
  'custom-slash-command': customSlashCommandScenario,
  'file-autocomplete': fileAutocompleteScenario,
  'first-run-onboarding': firstRunOnboardingScenario,
  'github-signals-command': githubSignalsCommandScenario,
  'visible-commands': visibleCommandsScenario,
  'integration-commands': integrationCommandsScenario,
  'modal-and-shell': modalAndShellScenario,
  'mcp-server-config': mcpServerConfigScenario,
  'notification-signal-rendering': notificationSignalRenderingScenario,
  'om-settings': omSettingsScenario,
  'openai-strict-schema': openaiStrictSchemaScenario,
  'process-shortcuts': processShortcutsScenario,
  'provider-history-compat': providerHistoryCompatScenario,
  'prompt-context-instructions': promptContextInstructionsScenario,
  'quiet-settings': quietSettingsScenario,
  'report-issue-command': reportIssueCommandScenario,
  'state-commands': stateCommandsScenario,
  'state-signal-rendering': stateSignalRenderingScenario,
  'storage-settings': storageSettingsScenario,
  'stream-error-retry': streamErrorRetryScenario,
  'streaming-tool-args': streamingToolArgsScenario,
  'task-progress-events': taskProgressEventsScenario,
  'thread-history': threadHistoryScenario,
  'tool-schema-compat': toolSchemaCompatScenario,
  'update-command-prompt': updateCommandPromptScenario,
  'workspace-commands': workspaceCommandsScenario,
  'workspace-tool-names': workspaceToolNamesScenario,
};

export function getScenario(name: ScenarioName): McE2eScenario {
  return scenarios[name];
}

export function listScenarios(): McE2eScenario[] {
  return Object.values(scenarios);
}
