import { abortFollowupScenario } from './abort-followup.js';
import { activeSignalFollowupScenario } from './active-signal-followup.js';
import { apiKeyDeleteEnvScenario } from './api-key-delete-env.js';
import { apiKeyMultiProviderDeleteScenario } from './api-key-multi-provider-delete.js';
import { apiKeyPromptScenario } from './api-key-prompt.js';
import { apiKeyReopenStoredScenario } from './api-key-reopen-stored.js';
import { askUserAdvancedPromptsScenario } from './ask-user-advanced-prompts.js';
import { autocompleteWrappingNavigationScenario } from './autocomplete-wrapping-navigation.js';
import { automatedChatScenario } from './automated-chat.js';
import { branchContextLongNameScenario } from './branch-context-long-name.js';
import { browserActivePendingStatusScenario } from './browser-active-pending-status.js';
import { browserProfileProviderMismatchScenario } from './browser-profile-provider-mismatch.js';
import { browserSettingsPersistenceScenario } from './browser-settings-persistence.js';
import { browserStartupRestoreScenario } from './browser-startup-restore.js';
import { browserToggleAttachScenario } from './browser-toggle-attach.js';
import { browserToolUnavailableScenario } from './browser-tool-unavailable.js';
import { browserWizardBrowserbaseScenario } from './browser-wizard-browserbase.js';
import { browserWizardExportScenario } from './browser-wizard-export.js';
import { browserbaseStartupRestoreScenario } from './browserbase-startup-restore.js';
import { clipboardImagePasteScenario } from './clipboard-image-paste.js';
import { commitAttributionPromptScenario } from './commit-attribution-prompt.js';
import { controllerApiConfigScenario } from './controller-api-config.js';
import { ctrlfQueuedCustomSlashScenario } from './ctrlf-queued-custom-slash.js';
import { ctrlfQueuedImageFollowupScenario } from './ctrlf-queued-image-followup.js';
import { customConfigDirScenario } from './custom-config-dir.js';
import { customPackImportOverwriteScenario } from './custom-pack-import-overwrite.js';
import { customPackImportRenameScenario } from './custom-pack-import-rename.js';
import { customPackRenameActiveScenario } from './custom-pack-rename-active.js';
import { customProviderDeleteScenario } from './custom-provider-delete.js';
import { customProviderEditShareImportScenario } from './custom-provider-edit-share-import.js';
import { customProviderManagementScenario } from './custom-provider-management.js';
import { customProviderModalValidationScenario } from './custom-provider-modal-validation.js';
import { customProviderModelSelectorScenario } from './custom-provider-model-selector.js';
import { customSlashCommandScenario } from './custom-slash-command.js';
import { debugLoggingScenario } from './debug-logging.js';
import { fileAttachmentBlockedRetryScenario } from './file-attachment-blocked-retry.js';
import { fileAttachmentHistoryReloadScenario } from './file-attachment-history-reload.js';
import { fileAutocompleteScenario } from './file-autocomplete.js';
import { firstRunOnboardingScenario } from './first-run-onboarding.js';
import { githubSignalsCommandScenario } from './github-signals-command.js';
import { githubSignalsIncrementalScenario } from './github-signals-incremental.js';
import { githubSignalsNotificationReloadScenario } from './github-signals-notification-reload.js';
import { githubSignalsPollingInboxScenario } from './github-signals-polling-inbox.js';
import { githubSignalsUnsubscribeReloadScenario } from './github-signals-unsubscribe-reload.js';
import { goalApiErrorStopsLoopScenario } from './goal-api-error-stops-loop.js';
import { goalDurationToolApprovalScenario } from './goal-duration-tool-approval.js';
import { goalJudgeOmModelIsolationScenario } from './goal-judge-om-model-isolation.js';
import { goalJudgeSingleRenderScenario } from './goal-judge-single-render.js';
import { headlessMcpToolAvailabilityScenario } from './headless-mcp-tool-availability.js';
import { integrationCommandsScenario } from './integration-commands.js';
import { lifecycleHooksConfiguredScenario } from './lifecycle-hooks-configured.js';
import { lifecycleHooksEventsScenario } from './lifecycle-hooks-events.js';
import { loginDialogMaskedInputScenario } from './login-dialog-masked-input.js';
import { loginPreservesModelPackScenario } from './login-preserves-model-pack.js';
import { mcpHttpToolCallScenario } from './mcp-http-tool-call.js';
import { mcpLongRunningToolScenario } from './mcp-long-running-tool.js';
import { mcpOauthAuthenticateScenario } from './mcp-oauth-authenticate.js';
import { mcpOauthCancelScenario } from './mcp-oauth-cancel.js';
import { mcpReloadConfigScenario } from './mcp-reload-config.js';
import { mcpSelectorReconnectScenario } from './mcp-selector-reconnect.js';
import { mcpServerConfigScenario } from './mcp-server-config.js';
import { mcpSkippedValidationScenario } from './mcp-skipped-validation.js';
import { modalAndShellScenario } from './modal-and-shell.js';
import { modelSelectionApiKeyPromptScenario } from './model-selection-api-key-prompt.js';
import { modelSelectionCancelEnvScenario } from './model-selection-cancel-env.js';
import { modelsPackActivationPersistenceScenario } from './models-pack-activation-persistence.js';
import { notificationInboxCrudFlowScenario } from './notification-inbox-crud-flow.js';
import { notificationInboxReloadScenario } from './notification-inbox-reload.js';
import { notificationInboxToolFlowScenario } from './notification-inbox-tool-flow.js';
import { notificationSignalRenderingScenario } from './notification-signal-rendering.js';
import { omAttachmentObservationScenario } from './om-attachment-observation.js';
import { omGlobalSettingsPersistenceScenario } from './om-global-settings-persistence.js';
import { omModelOverrideReloadScenario } from './om-model-override-reload.js';
import { omPackStartupRestoreScenario } from './om-pack-startup-restore.js';
import { omSettingsScenario } from './om-settings.js';
import { omStatusIndicatorScenario } from './om-status-indicator.js';
import { omThresholdPersistenceScenario } from './om-threshold-persistence.js';
import { openaiStrictSchemaScenario } from './openai-strict-schema.js';
import { persistentGoalCommandsScenario } from './persistent-goal-commands.js';
import { persistentGoalJudgeDecisionScenario } from './persistent-goal-judge-decision.js';
import { persistentGoalReloadScenario } from './persistent-goal-reload.js';
import { planApprovalGoalHandoffScenario } from './plan-approval-goal-handoff.js';
import { planApprovalHandoffScenario } from './plan-approval-handoff.js';
import { planApprovalRequestChangesScenario } from './plan-approval-request-changes.js';
import {
  pluginsAssetsLoadingScenario,
  pluginsBlockedConfigScenario,
  pluginsCommandUiScenario,
  pluginsGithubInstallInvalidPackageManagerScenario,
  pluginsGithubInstallMissingCorepackScenario,
  pluginsGithubInstallPnpm10Scenario,
  pluginsGithubInstallPnpm11Scenario,
  pluginsGithubPollUpdateScenario,
  pluginsLocalHotReloadScenario,
  pluginsLocalToolScenario,
  pluginsScaffoldInstallToolScenario,
  pluginsStreamingToolOutputScenario,
} from './plugins.js';
import { processShortcutsScenario } from './process-shortcuts.js';
import { promptContextInstructionsScenario } from './prompt-context-instructions.js';
import { promptQueueInterleaveScenario } from './prompt-queue-interleave.js';
import { providerHistoryCompatScenario } from './provider-history-compat.js';
import { providerHistoryRejectionRetryScenario } from './provider-history-rejection-retry.js';
import { pruneCommandScenario } from './prune-command.js';
import { quietSettingsScenario } from './quiet-settings.js';
import { quietStreamingPreviewHeightScenario } from './quiet-streaming-preview-height.js';
import { quietToolHistoryParityScenario } from './quiet-tool-history-parity.js';
import { reportIssueCommandScenario } from './report-issue-command.js';
import { requestAccessModalScenario } from './request-access-modal.js';
import { resourceidDriftPromptAcceptScenario } from './resourceid-drift-prompt-accept.js';
import { resourceidDriftPromptDeclineScenario } from './resourceid-drift-prompt-decline.js';
import { settingsApiKeysNavigationScenario } from './settings-api-keys-navigation.js';
import { settingsStartupModelRestoreScenario } from './settings-startup-model-restore.js';
import { setupCompletionPersistenceScenario } from './setup-completion-persistence.js';
import { setupCustomPackCompletionScenario } from './setup-custom-pack-completion.js';
import { setupLoginRefreshScenario } from './setup-login-refresh.js';
import { setupNestedModelSelectorScenario } from './setup-nested-model-selector.js';
import { shellPassthroughConfiguredSettingsScenario } from './shell-passthrough-configured-settings.js';
import { shellPassthroughEnvOverrideScenario } from './shell-passthrough-env-override.js';
import { shellPassthroughLongOutputScenario } from './shell-passthrough-long-output.js';
import { shellPassthroughNonpersistentScenario } from './shell-passthrough-nonpersistent.js';
import { skillsCommandActivationScenario } from './skills-command-activation.js';
import { skillsSymlinkDedupeScenario } from './skills-symlink-dedupe.js';
import { startupScenario } from './startup.js';
import { stateCommandsScenario } from './state-commands.js';
import { stateSignalBrowserProcessorScenario } from './state-signal-browser-processor.js';
import { stateSignalReloadScenario } from './state-signal-reload.js';
import { stateSignalRenderingScenario } from './state-signal-rendering.js';
import { storageFallbackHistoryReloadScenario } from './storage-fallback-history-reload.js';
import { storageSettingsScenario } from './storage-settings.js';
import { storageStartupPgFallbackScenario } from './storage-startup-pg-fallback.js';
import { streamErrorRetryScenario } from './stream-error-retry.js';
import { streamingToolArgsScenario } from './streaming-tool-args.js';
import { subagentDelegationScenario } from './subagent-delegation.js';
import { subagentModelStartupRestoreScenario } from './subagent-model-startup-restore.js';
import { subagentPlanExecuteToolsScenario } from './subagent-plan-execute-tools.js';
import { taskInlineTransitionsScenario } from './task-inline-transitions.js';
import { taskPatchToolsScenario } from './task-patch-tools.js';
import { taskProgressEventsScenario } from './task-progress-events.js';
import { taskPromptContextNextTurnScenario } from './task-prompt-context-next-turn.js';
import { terminalResizeReflowScenario } from './terminal-resize-reflow.js';
import { threadHistoryScenario } from './thread-history.js';
import { toolHistoryReloadScenario } from './tool-history-reload.js';
import { toolSchemaCompatScenario } from './tool-schema-compat.js';
import { toolSuspensionSameRunResumeScenario } from './tool-suspension-same-run-resume.js';
import type { McE2eScenario, ScenarioName } from './types.js';
import { updateCommandPromptScenario } from './update-command-prompt.js';
import { updateStartupPromptScenario } from './update-startup-prompt.js';
import { visibleCommandsScenario } from './visible-commands.js';
import { webSearchRenderingScenario } from './web-search-rendering.js';
import { workIdleStatusScenario } from './work-idle-status.js';
import { workspaceCommandsScenario } from './workspace-commands.js';
import { workspacePlanModeToolsScenario } from './workspace-plan-mode-tools.js';
import { workspaceToolNamesScenario } from './workspace-tool-names.js';
import { workspaceToolOutputRenderingScenario } from './workspace-tool-output-rendering.js';
import { worktreeCrossThreadResumeScenario } from './worktree-cross-thread-resume.js';
import { worktreeThreadScopingScenario } from './worktree-thread-scoping.js';

export type { McE2eScenario, McE2eScenarioRuntime, ScenarioName } from './types.js';

export const scenarios: Record<ScenarioName, McE2eScenario> = {
  startup: startupScenario,
  'abort-followup': abortFollowupScenario,
  'branch-context-long-name': branchContextLongNameScenario,
  'active-signal-followup': activeSignalFollowupScenario,
  'autocomplete-wrapping-navigation': autocompleteWrappingNavigationScenario,
  'api-key-delete-env': apiKeyDeleteEnvScenario,
  'api-key-multi-provider-delete': apiKeyMultiProviderDeleteScenario,
  'api-key-prompt': apiKeyPromptScenario,
  'api-key-reopen-stored': apiKeyReopenStoredScenario,
  'ask-user-advanced-prompts': askUserAdvancedPromptsScenario,
  'automated-chat': automatedChatScenario,
  'browser-active-pending-status': browserActivePendingStatusScenario,
  'browser-profile-provider-mismatch': browserProfileProviderMismatchScenario,
  'browser-settings-persistence': browserSettingsPersistenceScenario,
  'browser-startup-restore': browserStartupRestoreScenario,
  'browser-tool-unavailable': browserToolUnavailableScenario,
  'browserbase-startup-restore': browserbaseStartupRestoreScenario,
  'browser-toggle-attach': browserToggleAttachScenario,
  'browser-wizard-browserbase': browserWizardBrowserbaseScenario,
  'browser-wizard-export': browserWizardExportScenario,
  'clipboard-image-paste': clipboardImagePasteScenario,
  'commit-attribution-prompt': commitAttributionPromptScenario,
  'custom-config-dir': customConfigDirScenario,
  'custom-pack-import-overwrite': customPackImportOverwriteScenario,
  'custom-pack-import-rename': customPackImportRenameScenario,
  'custom-pack-rename-active': customPackRenameActiveScenario,
  'custom-provider-delete': customProviderDeleteScenario,
  'custom-provider-edit-share-import': customProviderEditShareImportScenario,
  'custom-provider-management': customProviderManagementScenario,
  'custom-provider-modal-validation': customProviderModalValidationScenario,
  'custom-provider-model-selector': customProviderModelSelectorScenario,
  'custom-slash-command': customSlashCommandScenario,
  'ctrlf-queued-custom-slash': ctrlfQueuedCustomSlashScenario,
  'ctrlf-queued-image-followup': ctrlfQueuedImageFollowupScenario,
  'debug-logging': debugLoggingScenario,
  'file-attachment-blocked-retry': fileAttachmentBlockedRetryScenario,
  'file-attachment-history-reload': fileAttachmentHistoryReloadScenario,
  'file-autocomplete': fileAutocompleteScenario,
  'first-run-onboarding': firstRunOnboardingScenario,
  'github-signals-command': githubSignalsCommandScenario,
  'github-signals-incremental': githubSignalsIncrementalScenario,
  'github-signals-notification-reload': githubSignalsNotificationReloadScenario,
  'github-signals-polling-inbox': githubSignalsPollingInboxScenario,
  'github-signals-unsubscribe-reload': githubSignalsUnsubscribeReloadScenario,
  'goal-api-error-stops-loop': goalApiErrorStopsLoopScenario,
  'goal-duration-tool-approval': goalDurationToolApprovalScenario,
  'goal-judge-om-model-isolation': goalJudgeOmModelIsolationScenario,
  'goal-judge-single-render': goalJudgeSingleRenderScenario,
  'controller-api-config': controllerApiConfigScenario,
  'headless-mcp-tool-availability': headlessMcpToolAvailabilityScenario,
  'visible-commands': visibleCommandsScenario,
  'integration-commands': integrationCommandsScenario,
  'lifecycle-hooks-configured': lifecycleHooksConfiguredScenario,
  'lifecycle-hooks-events': lifecycleHooksEventsScenario,
  'login-dialog-masked-input': loginDialogMaskedInputScenario,
  'login-preserves-model-pack': loginPreservesModelPackScenario,
  'modal-and-shell': modalAndShellScenario,
  'mcp-http-tool-call': mcpHttpToolCallScenario,
  'mcp-long-running-tool': mcpLongRunningToolScenario,
  'mcp-oauth-authenticate': mcpOauthAuthenticateScenario,
  'mcp-oauth-cancel': mcpOauthCancelScenario,
  'mcp-reload-config': mcpReloadConfigScenario,
  'mcp-selector-reconnect': mcpSelectorReconnectScenario,
  'mcp-server-config': mcpServerConfigScenario,
  'mcp-skipped-validation': mcpSkippedValidationScenario,
  'model-selection-api-key-prompt': modelSelectionApiKeyPromptScenario,
  'model-selection-cancel-env': modelSelectionCancelEnvScenario,
  'models-pack-activation-persistence': modelsPackActivationPersistenceScenario,
  'notification-inbox-crud-flow': notificationInboxCrudFlowScenario,
  'notification-inbox-reload': notificationInboxReloadScenario,
  'notification-inbox-tool-flow': notificationInboxToolFlowScenario,
  'notification-signal-rendering': notificationSignalRenderingScenario,
  'om-attachment-observation': omAttachmentObservationScenario,
  'om-global-settings-persistence': omGlobalSettingsPersistenceScenario,
  'om-model-override-reload': omModelOverrideReloadScenario,
  'om-pack-startup-restore': omPackStartupRestoreScenario,
  'om-settings': omSettingsScenario,
  'om-status-indicator': omStatusIndicatorScenario,
  'om-threshold-persistence': omThresholdPersistenceScenario,
  'openai-strict-schema': openaiStrictSchemaScenario,
  'persistent-goal-commands': persistentGoalCommandsScenario,
  'persistent-goal-judge-decision': persistentGoalJudgeDecisionScenario,
  'persistent-goal-reload': persistentGoalReloadScenario,
  'plan-approval-goal-handoff': planApprovalGoalHandoffScenario,
  'plan-approval-handoff': planApprovalHandoffScenario,
  'plan-approval-request-changes': planApprovalRequestChangesScenario,
  'plugins-local-tool': pluginsLocalToolScenario,
  'plugins-local-hot-reload': pluginsLocalHotReloadScenario,
  'plugins-github-install-gh-cli-pnpm-10': pluginsGithubInstallPnpm10Scenario,
  'plugins-github-install-gh-cli-pnpm-11': pluginsGithubInstallPnpm11Scenario,
  'plugins-github-install-missing-corepack': pluginsGithubInstallMissingCorepackScenario,
  'plugins-github-install-invalid-package-manager': pluginsGithubInstallInvalidPackageManagerScenario,
  'plugins-github-poll-update': pluginsGithubPollUpdateScenario,
  'plugins-blocked-config': pluginsBlockedConfigScenario,
  'plugins-scaffold-install-tool': pluginsScaffoldInstallToolScenario,
  'plugins-streaming-tool-output': pluginsStreamingToolOutputScenario,
  'plugins-assets-loading': pluginsAssetsLoadingScenario,
  'plugins-command-ui': pluginsCommandUiScenario,
  'process-shortcuts': processShortcutsScenario,
  'provider-history-compat': providerHistoryCompatScenario,
  'provider-history-rejection-retry': providerHistoryRejectionRetryScenario,
  'prompt-context-instructions': promptContextInstructionsScenario,
  'prompt-queue-interleave': promptQueueInterleaveScenario,
  'prune-command': pruneCommandScenario,
  'quiet-settings': quietSettingsScenario,
  'quiet-streaming-preview-height': quietStreamingPreviewHeightScenario,
  'quiet-tool-history-parity': quietToolHistoryParityScenario,
  'report-issue-command': reportIssueCommandScenario,
  'request-access-modal': requestAccessModalScenario,
  'state-commands': stateCommandsScenario,
  'state-signal-browser-processor': stateSignalBrowserProcessorScenario,
  'state-signal-reload': stateSignalReloadScenario,
  'state-signal-rendering': stateSignalRenderingScenario,
  'setup-completion-persistence': setupCompletionPersistenceScenario,
  'setup-custom-pack-completion': setupCustomPackCompletionScenario,
  'setup-login-refresh': setupLoginRefreshScenario,
  'setup-nested-model-selector': setupNestedModelSelectorScenario,
  'settings-api-keys-navigation': settingsApiKeysNavigationScenario,
  'settings-startup-model-restore': settingsStartupModelRestoreScenario,
  'shell-passthrough-configured-settings': shellPassthroughConfiguredSettingsScenario,
  'shell-passthrough-env-override': shellPassthroughEnvOverrideScenario,
  'shell-passthrough-long-output': shellPassthroughLongOutputScenario,
  'shell-passthrough-nonpersistent': shellPassthroughNonpersistentScenario,
  'skills-command-activation': skillsCommandActivationScenario,
  'skills-symlink-dedupe': skillsSymlinkDedupeScenario,
  'storage-fallback-history-reload': storageFallbackHistoryReloadScenario,
  'storage-settings': storageSettingsScenario,
  'storage-startup-pg-fallback': storageStartupPgFallbackScenario,
  'stream-error-retry': streamErrorRetryScenario,
  'streaming-tool-args': streamingToolArgsScenario,
  'subagent-delegation': subagentDelegationScenario,
  'subagent-plan-execute-tools': subagentPlanExecuteToolsScenario,
  'subagent-model-startup-restore': subagentModelStartupRestoreScenario,
  'task-inline-transitions': taskInlineTransitionsScenario,
  'task-patch-tools': taskPatchToolsScenario,
  'task-progress-events': taskProgressEventsScenario,
  'task-prompt-context-next-turn': taskPromptContextNextTurnScenario,
  'terminal-resize-reflow': terminalResizeReflowScenario,
  'thread-history': threadHistoryScenario,
  'tool-history-reload': toolHistoryReloadScenario,
  'tool-schema-compat': toolSchemaCompatScenario,
  'tool-suspension-same-run-resume': toolSuspensionSameRunResumeScenario,
  'update-command-prompt': updateCommandPromptScenario,
  'update-startup-prompt': updateStartupPromptScenario,
  'web-search-rendering': webSearchRenderingScenario,
  'workspace-commands': workspaceCommandsScenario,
  'workspace-plan-mode-tools': workspacePlanModeToolsScenario,
  'workspace-tool-names': workspaceToolNamesScenario,
  'workspace-tool-output-rendering': workspaceToolOutputRenderingScenario,
  'work-idle-status': workIdleStatusScenario,
  'resourceid-drift-prompt-accept': resourceidDriftPromptAcceptScenario,
  'resourceid-drift-prompt-decline': resourceidDriftPromptDeclineScenario,
  'worktree-cross-thread-resume': worktreeCrossThreadResumeScenario,
  'worktree-thread-scoping': worktreeThreadScopingScenario,
};

export function getScenario(name: ScenarioName): McE2eScenario {
  return scenarios[name];
}

export function listScenarios(): McE2eScenario[] {
  return Object.values(scenarios);
}
