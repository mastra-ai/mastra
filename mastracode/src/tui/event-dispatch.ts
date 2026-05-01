/**
 * Event dispatcher: maps HarnessEvent types to extracted handler functions.
 */
import type { HarnessEvent, HarnessThread, TaskItem } from '@mastra/core/harness';

import { getCurrentGitBranch } from '../utils/project.js';
import {
  handleAgentStart,
  handleAgentEnd,
  handleAgentAborted,
  handleAgentError,
  handleMessageStart,
  handleMessageUpdate,
  handleMessageEnd,
  handleOMObservationStart,
  handleOMObservationEnd,
  handleOMReflectionStart,
  handleOMReflectionEnd,
  handleOMFailed,
  handleOMBufferingStart,
  handleOMBufferingEnd,
  handleOMBufferingFailed,
  handleOMActivation,
  handleOMThreadTitleUpdated,
  handleAskQuestion,
  handleSandboxAccessRequest,
  handlePlanApproval,
  handleSubagentStart,
  handleSubagentToolStart,
  handleSubagentToolEnd,
  handleSubagentEnd,
  handleToolApprovalRequired,
  handleToolStart,
  handleToolUpdate,
  handleShellOutput,
  handleToolInputStart,
  handleToolInputDelta,
  handleToolInputEnd,
  handleToolEnd,
} from './handlers/index.js';
import type { EventHandlerContext } from './handlers/types.js';
import type { TUIState } from './state.js';

/**
 * Dispatch a HarnessEvent to the appropriate handler.
 */
export async function dispatchEvent(event: HarnessEvent, ectx: EventHandlerContext, state: TUIState): Promise<void> {
  switch (event.type) {
    case 'agent_start':
      handleAgentStart(ectx);
      break;

    case 'agent_end':
      if (event.reason === 'aborted') {
        handleAgentAborted(ectx);
      } else if (event.reason === 'error') {
        handleAgentError(ectx);
      } else {
        handleAgentEnd(ectx);
      }
      break;

    case 'message_start':
      handleMessageStart(ectx, event.message);
      break;

    case 'message_update':
      handleMessageUpdate(ectx, event.message);
      break;

    case 'message_end':
      handleMessageEnd(ectx, event.message);
      break;

    case 'tool_start':
      handleToolStart(ectx, event.toolCallId, event.toolName, event.args);
      break;

    case 'tool_approval_required':
      handleToolApprovalRequired(ectx, event.toolCallId, event.toolName, event.args);
      break;

    case 'tool_update':
      handleToolUpdate(ectx, event.toolCallId, event.partialResult);
      break;

    case 'shell_output':
      handleShellOutput(ectx, event.toolCallId, event.output, event.stream);
      break;

    case 'tool_input_start':
      handleToolInputStart(ectx, event.toolCallId, event.toolName);
      break;

    case 'tool_input_delta':
      handleToolInputDelta(ectx, event.toolCallId, event.argsTextDelta);
      break;

    case 'tool_input_end':
      handleToolInputEnd(ectx, event.toolCallId);
      break;

    case 'tool_end':
      handleToolEnd(ectx, event.toolCallId, event.result, event.isError);
      break;

    case 'info':
      ectx.showInfo(event.message);
      break;

    case 'error':
      ectx.showFormattedError(event);
      break;

    case 'mode_changed':
      await ectx.refreshModelAuthStatus();
      break;

    case 'model_changed':
      await ectx.refreshModelAuthStatus();
      break;

    case 'thread_changed': {
      ectx.showInfo(`Switched to thread: ${event.threadId}`);
      // Clear per-thread ephemeral state first so renderExistingMessages
      // and other downstream observers see clean state.
      await state.harness.setState({ tasks: [], activePlan: null, sandboxAllowedPaths: [] });
      if (state.taskProgress) {
        state.taskProgress.updateTasks([]);
        state.ui.requestRender();
      }
      state.taskWriteInsertIndex = -1;
      await ectx.renderExistingMessages();
      await state.harness.loadOMProgress();
      // Refresh git branch so TUI status line reflects the current branch
      const freshBranch = getCurrentGitBranch(state.projectInfo.rootPath);
      if (freshBranch) {
        state.projectInfo.gitBranch = freshBranch;
      }
      // Update current thread title for status line display
      const threads = await state.harness.listThreads();
      const currentThread = threads.find((t: HarnessThread) => t.id === event.threadId);
      if (currentThread) {
        state.currentThreadTitle = currentThread.title;
        // Load goal state from thread metadata
        state.goalManager.loadFromThreadMetadata(currentThread.metadata as Record<string, unknown> | undefined);
      }
      break;
    }

    case 'thread_created': {
      ectx.showInfo(`Created thread: ${event.thread.id}`);
      // Update current thread title for status line display
      state.currentThreadTitle = event.thread.title;
      // Sync inherited resource-level settings
      const tState = state.harness.getState() as any;
      if (typeof tState?.escapeAsCancel === 'boolean') {
        state.editor.escapeEnabled = tState.escapeAsCancel;
      }
      // Clear per-thread ephemeral state so new threads start clean.
      await state.harness.setState({ tasks: [], activePlan: null, sandboxAllowedPaths: [] });
      if (state.taskProgress) {
        state.taskProgress.updateTasks([]);
      }
      state.taskWriteInsertIndex = -1;
      break;
    }

    case 'usage_update':
      // Token accumulation handled by Harness display state
      break;

    // Observational Memory events
    case 'om_status':
      // All state updates handled by Harness applyDisplayStateUpdate
      break;

    case 'om_observation_start':
      handleOMObservationStart(ectx, event.cycleId, event.tokensToObserve);
      break;

    case 'om_observation_end':
      handleOMObservationEnd(
        ectx,
        event.cycleId,
        event.durationMs,
        event.tokensObserved,
        event.observationTokens,
        event.observations,
        event.currentTask,
        event.suggestedResponse,
      );
      break;

    case 'om_observation_failed':
      handleOMFailed(ectx, event.cycleId, event.error, 'observation');
      break;

    case 'om_reflection_start':
      handleOMReflectionStart(ectx, event.cycleId, event.tokensToReflect);
      break;

    case 'om_reflection_end':
      handleOMReflectionEnd(ectx, event.cycleId, event.durationMs, event.compressedTokens, event.observations);
      break;

    case 'om_reflection_failed':
      handleOMFailed(ectx, event.cycleId, event.error, 'reflection');
      break;

    case 'om_buffering_start':
      handleOMBufferingStart(ectx, event.operationType, event.tokensToBuffer);
      break;

    case 'om_buffering_end':
      handleOMBufferingEnd(ectx, event.operationType, event.tokensBuffered, event.bufferedTokens, event.observations);
      break;

    case 'om_buffering_failed':
      handleOMBufferingFailed(ectx, event.operationType, event.error);
      break;

    case 'om_activation': {
      const activationEvent = event as Extract<HarnessEvent, { type: 'om_activation' }> & {
        triggeredBy?: 'threshold' | 'ttl' | 'provider_change';
        lastActivityAt?: number;
        ttlExpiredMs?: number;
        activateAfterIdle?: number;
        previousModel?: string;
        currentModel?: string;
      };
      handleOMActivation(
        ectx,
        activationEvent.operationType,
        activationEvent.tokensActivated,
        activationEvent.observationTokens,
        activationEvent.triggeredBy,
        activationEvent.activateAfterIdle,
        activationEvent.ttlExpiredMs,
        activationEvent.previousModel,
        activationEvent.currentModel,
      );
      break;
    }

    case 'om_thread_title_updated':
      state.currentThreadTitle = event.newTitle;
      handleOMThreadTitleUpdated(ectx, event.newTitle, event.oldTitle);
      ectx.updateStatusLine();
      break;

    case 'follow_up_queued': {
      ectx.updateStatusLine();
      break;
    }

    case 'workspace_ready':
      // Workspace initialized successfully - silent unless verbose
      break;

    case 'workspace_error':
      ectx.showError(`Workspace: ${event.error.message}`);
      break;

    case 'workspace_status_changed':
      if (event.status === 'error' && event.error) {
        ectx.showError(`Workspace: ${event.error.message}`);
      }
      break;

    // Subagent / Task delegation events
    case 'subagent_start':
      handleSubagentStart(ectx, event.toolCallId, event.agentType, event.task, event.modelId, event.forked);
      break;

    case 'subagent_tool_start':
      handleSubagentToolStart(ectx, event.toolCallId, event.subToolName, event.subToolArgs);
      break;

    case 'subagent_tool_end':
      handleSubagentToolEnd(ectx, event.toolCallId, event.subToolName, event.subToolResult, event.isError);
      break;

    case 'subagent_text_delta':
      // Text deltas are streamed but we don't render them incrementally
      // (the final result is shown via tool_end for the parent tool call)
      break;

    case 'subagent_end':
      handleSubagentEnd(ectx, event.toolCallId, event.isError, event.durationMs, event.result);
      break;

    case 'task_updated': {
      const tasks = event.tasks as TaskItem[];
      if (state.taskProgress) {
        state.taskProgress.updateTasks(tasks ?? []);

        // Find the most recent task_write tool component and get its position
        let insertIndex = -1;
        for (let i = state.allToolComponents.length - 1; i >= 0; i--) {
          const comp = state.allToolComponents[i];
          if ((comp as any).toolName === 'task_write') {
            insertIndex = state.chatContainer.children.indexOf(comp as any);
            state.chatContainer.removeChild(comp as any);
            state.allToolComponents.splice(i, 1);
            break;
          }
        }
        // Fall back to the position recorded during streaming (when no inline component was created)
        if (insertIndex === -1 && state.taskWriteInsertIndex >= 0) {
          insertIndex = state.taskWriteInsertIndex;
          state.taskWriteInsertIndex = -1;
        }

        // Check if all tasks are completed
        const allCompleted = tasks && tasks.length > 0 && tasks.every(t => t.status === 'completed');
        if (allCompleted) {
          // Show collapsed completed list (pinned/live)
          ectx.renderCompletedTasksInline(tasks, insertIndex, true);
        } else if (state.harness.getDisplayState().previousTasks.length > 0 && (!tasks || tasks.length === 0)) {
          // Tasks were cleared
          ectx.renderClearedTasksInline(state.harness.getDisplayState().previousTasks, insertIndex);
        }

        state.ui.requestRender();
      }
      break;
    }

    case 'ask_question':
      await handleAskQuestion(ectx, event.questionId, event.question, event.options);
      break;

    case 'sandbox_access_request':
      await handleSandboxAccessRequest(ectx, event.questionId, event.path, event.reason);
      break;

    case 'plan_approval_required':
      await handlePlanApproval(ectx, event.planId, event.title, event.plan);
      break;

    case 'plan_approved':
      // Handled directly in onApprove callback to ensure proper sequencing
      break;

    case 'display_state_changed':
      // The Harness emits this after every event with the updated display state.
      // Use it as the single trigger for status-line re-renders since all the
      // fields it reads (isRunning, omProgress, buffering flags) are now
      // maintained by the Harness.
      ectx.updateStatusLine();
      break;
  }
}
