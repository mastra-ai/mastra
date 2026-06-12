import { activeSignalFollowupScenario } from './active-signal-followup.js';
import { apiKeyDeleteEnvScenario } from './api-key-delete-env.js';
import { apiKeyPromptScenario } from './api-key-prompt.js';
import { askUserAdvancedPromptsScenario } from './ask-user-advanced-prompts.js';
import { automatedChatScenario } from './automated-chat.js';
import { branchContextLongNameScenario } from './branch-context-long-name.js';
import { clipboardImagePasteScenario } from './clipboard-image-paste.js';
import { commitAttributionPromptScenario } from './commit-attribution-prompt.js';
import { customConfigDirScenario } from './custom-config-dir.js';
import { customProviderManagementScenario } from './custom-provider-management.js';
import { customSlashCommandScenario } from './custom-slash-command.js';
import { debugLoggingScenario } from './debug-logging.js';
import { fileAutocompleteScenario } from './file-autocomplete.js';
import { firstRunOnboardingScenario } from './first-run-onboarding.js';
import { githubSignalsCommandScenario } from './github-signals-command.js';
import { githubSignalsIncrementalScenario } from './github-signals-incremental.js';
import { harnessApiConfigScenario } from './harness-api-config.js';
import { integrationCommandsScenario } from './integration-commands.js';
import { mcpServerConfigScenario } from './mcp-server-config.js';
import { modalAndShellScenario } from './modal-and-shell.js';
import { modelsPackActivationPersistenceScenario } from './models-pack-activation-persistence.js';
import { notificationInboxCrudFlowScenario } from './notification-inbox-crud-flow.js';
import { notificationInboxReloadScenario } from './notification-inbox-reload.js';
import { notificationInboxToolFlowScenario } from './notification-inbox-tool-flow.js';
import { notificationSignalRenderingScenario } from './notification-signal-rendering.js';
import { omGlobalSettingsPersistenceScenario } from './om-global-settings-persistence.js';
import { omSettingsScenario } from './om-settings.js';
import { openaiStrictSchemaScenario } from './openai-strict-schema.js';
import { persistentGoalCommandsScenario } from './persistent-goal-commands.js';
import { persistentGoalJudgeDecisionScenario } from './persistent-goal-judge-decision.js';
import { persistentGoalReloadScenario } from './persistent-goal-reload.js';
import { planApprovalGoalHandoffScenario } from './plan-approval-goal-handoff.js';
import { planApprovalHandoffScenario } from './plan-approval-handoff.js';
import { processShortcutsScenario } from './process-shortcuts.js';
import { promptContextInstructionsScenario } from './prompt-context-instructions.js';
import { promptQueueInterleaveScenario } from './prompt-queue-interleave.js';
import { providerHistoryCompatScenario } from './provider-history-compat.js';
import { quietSettingsScenario } from './quiet-settings.js';
import { quietToolHistoryParityScenario } from './quiet-tool-history-parity.js';
import { reportIssueCommandScenario } from './report-issue-command.js';
import { requestAccessModalScenario } from './request-access-modal.js';
import { setupCompletionPersistenceScenario } from './setup-completion-persistence.js';
import { setupNestedModelSelectorScenario } from './setup-nested-model-selector.js';
import { startupScenario } from './startup.js';
import { stateCommandsScenario } from './state-commands.js';
import { stateSignalReloadScenario } from './state-signal-reload.js';
import { stateSignalRenderingScenario } from './state-signal-rendering.js';
import { storageSettingsScenario } from './storage-settings.js';
import { streamErrorRetryScenario } from './stream-error-retry.js';
import { streamingToolArgsScenario } from './streaming-tool-args.js';
import { subagentDelegationScenario } from './subagent-delegation.js';
import { taskInlineTransitionsScenario } from './task-inline-transitions.js';
import { taskPatchToolsScenario } from './task-patch-tools.js';
import { taskProgressEventsScenario } from './task-progress-events.js';
import { taskPromptContextNextTurnScenario } from './task-prompt-context-next-turn.js';
import { threadHistoryScenario } from './thread-history.js';
import { toolHistoryReloadScenario } from './tool-history-reload.js';
import { toolSchemaCompatScenario } from './tool-schema-compat.js';
import type { McE2eScenario, ScenarioName } from './types.js';
import { updateCommandPromptScenario } from './update-command-prompt.js';
import { visibleCommandsScenario } from './visible-commands.js';
import { webSearchRenderingScenario } from './web-search-rendering.js';
import { workspaceCommandsScenario } from './workspace-commands.js';
import { workspacePlanModeToolsScenario } from './workspace-plan-mode-tools.js';
import { workspaceToolNamesScenario } from './workspace-tool-names.js';
import { workspaceToolOutputRenderingScenario } from './workspace-tool-output-rendering.js';

export type { McE2eScenario, McE2eScenarioRuntime, ScenarioName } from './types.js';

export const scenarios: Record<ScenarioName, McE2eScenario> = {
  startup: startupScenario,
  'branch-context-long-name': branchContextLongNameScenario,
  'active-signal-followup': activeSignalFollowupScenario,
  'api-key-delete-env': apiKeyDeleteEnvScenario,
  'api-key-prompt': apiKeyPromptScenario,
  'ask-user-advanced-prompts': askUserAdvancedPromptsScenario,
  'automated-chat': automatedChatScenario,
  'clipboard-image-paste': clipboardImagePasteScenario,
  'commit-attribution-prompt': commitAttributionPromptScenario,
  'custom-config-dir': customConfigDirScenario,
  'custom-provider-management': customProviderManagementScenario,
  'custom-slash-command': customSlashCommandScenario,
  'debug-logging': debugLoggingScenario,
  'file-autocomplete': fileAutocompleteScenario,
  'first-run-onboarding': firstRunOnboardingScenario,
  'github-signals-command': githubSignalsCommandScenario,
  'github-signals-incremental': githubSignalsIncrementalScenario,
  'harness-api-config': harnessApiConfigScenario,
  'visible-commands': visibleCommandsScenario,
  'integration-commands': integrationCommandsScenario,
  'modal-and-shell': modalAndShellScenario,
  'mcp-server-config': mcpServerConfigScenario,
  'models-pack-activation-persistence': modelsPackActivationPersistenceScenario,
  'notification-inbox-crud-flow': notificationInboxCrudFlowScenario,
  'notification-inbox-reload': notificationInboxReloadScenario,
  'notification-inbox-tool-flow': notificationInboxToolFlowScenario,
  'notification-signal-rendering': notificationSignalRenderingScenario,
  'om-global-settings-persistence': omGlobalSettingsPersistenceScenario,
  'om-settings': omSettingsScenario,
  'openai-strict-schema': openaiStrictSchemaScenario,
  'persistent-goal-commands': persistentGoalCommandsScenario,
  'persistent-goal-judge-decision': persistentGoalJudgeDecisionScenario,
  'persistent-goal-reload': persistentGoalReloadScenario,
  'plan-approval-goal-handoff': planApprovalGoalHandoffScenario,
  'plan-approval-handoff': planApprovalHandoffScenario,
  'process-shortcuts': processShortcutsScenario,
  'provider-history-compat': providerHistoryCompatScenario,
  'prompt-context-instructions': promptContextInstructionsScenario,
  'prompt-queue-interleave': promptQueueInterleaveScenario,
  'quiet-settings': quietSettingsScenario,
  'quiet-tool-history-parity': quietToolHistoryParityScenario,
  'report-issue-command': reportIssueCommandScenario,
  'request-access-modal': requestAccessModalScenario,
  'state-commands': stateCommandsScenario,
  'state-signal-reload': stateSignalReloadScenario,
  'state-signal-rendering': stateSignalRenderingScenario,
  'setup-completion-persistence': setupCompletionPersistenceScenario,
  'setup-nested-model-selector': setupNestedModelSelectorScenario,
  'storage-settings': storageSettingsScenario,
  'stream-error-retry': streamErrorRetryScenario,
  'streaming-tool-args': streamingToolArgsScenario,
  'subagent-delegation': subagentDelegationScenario,
  'task-inline-transitions': taskInlineTransitionsScenario,
  'task-patch-tools': taskPatchToolsScenario,
  'task-progress-events': taskProgressEventsScenario,
  'task-prompt-context-next-turn': taskPromptContextNextTurnScenario,
  'thread-history': threadHistoryScenario,
  'tool-history-reload': toolHistoryReloadScenario,
  'tool-schema-compat': toolSchemaCompatScenario,
  'update-command-prompt': updateCommandPromptScenario,
  'web-search-rendering': webSearchRenderingScenario,
  'workspace-commands': workspaceCommandsScenario,
  'workspace-plan-mode-tools': workspacePlanModeToolsScenario,
  'workspace-tool-names': workspaceToolNamesScenario,
  'workspace-tool-output-rendering': workspaceToolOutputRenderingScenario,
};

export function getScenario(name: ScenarioName): McE2eScenario {
  return scenarios[name];
}

export function listScenarios(): McE2eScenario[] {
  return Object.values(scenarios);
}
