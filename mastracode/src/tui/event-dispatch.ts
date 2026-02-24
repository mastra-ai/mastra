/**
 * Event dispatcher: maps HarnessEvent types to extracted handler functions.
 */
import type { HarnessEvent, TaskItem } from '@mastra/core/harness';

import {
  handleAgentStart,
  handleAgentEnd,
  handleAgentAborted,
  handleAgentError,
  handleMessageStart,
  handleMessageUpdate,
  handleMessageEnd,
  handleUsageUpdate,
  handleOMStatus,
  handleOMObservationStart,
  handleOMObservationEnd,
  handleOMReflectionStart,
  handleOMReflectionEnd,
  handleOMFailed,
  handleOMBufferingStart,
  handleOMBufferingEnd,
  handleOMBufferingFailed,
  handleOMActivation,
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
      ectx.resetStatusLineState();
      await ectx.renderExistingMessages();
      await state.harness.loadOMProgress();
      ectx.syncOMThresholdsFromHarness();
      state.tokenUsage = state.harness.getTokenUsage();
      ectx.updateStatusLine();
      // Restore tasks from thread state
      const threadState = state.harness.getState() as {
        tasks?: TaskItem[];
      };
      if (state.taskProgress) {
        state.taskProgress.updateTasks(threadState.tasks ?? []);
        state.ui.requestRender();
      }
      break;
    }

    case 'thread_created': {
      ectx.showInfo(`Created thread: ${event.thread.id}`);
      // Sync inherited resource-level settings
      const tState = state.harness.getState() as any;
      if (typeof tState?.escapeAsCancel === 'boolean') {
        state.editor.escapeEnabled = tState.escapeAsCancel;
      }
      // Clear stale tasks from the previous thread
      if (state.taskProgress) {
        state.taskProgress.updateTasks([]);
      }
      state.previousTasks = [];
      state.taskWriteInsertIndex = -1;
      ectx.updateStatusLine();
      break;
    }

    case 'usage_update':
      handleUsageUpdate(ectx, event.usage);
      break;

    // Observational Memory events
    case 'om_status':
      handleOMStatus(ectx, event);
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

    case 'om_activation':
      handleOMActivation(ectx, event.operationType, event.tokensActivated, event.observationTokens);
      break;

    case 'follow_up_queued': {
      const totalPending = (event.count as number) + state.pendingSlashCommands.length;
      ectx.showInfo(`Follow-up queued (${totalPending} pending)`);
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
      handleSubagentStart(ectx, event.toolCallId, event.agentType, event.task, event.modelId);
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
        } else if (state.previousTasks.length > 0 && (!tasks || tasks.length === 0)) {
          // Tasks were cleared
          ectx.renderClearedTasksInline(state.previousTasks, insertIndex);
        }

        // Track for next diff
        state.previousTasks = tasks ? [...tasks] : [];

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
  }
}
