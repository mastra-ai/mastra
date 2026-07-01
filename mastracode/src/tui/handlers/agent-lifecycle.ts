/**
 * Event handlers for agent lifecycle events:
 * agent_start, agent_end (normal / aborted / error).
 */
import type { GoalEvaluationPayload } from '@mastra/core/stream';

import { getCurrentGitBranchAsync } from '../../utils/project.js';
import { insertChatComponentWithBoundarySpacing } from '../chat-boundary-reconciliation.js';
import { JudgeDisplayComponent } from '../components/judge-display.js';
import { GradientAnimator } from '../components/obi-loader.js';
import { pruneChatContainer } from '../prune-chat.js';
import { clearPendingUserMessages, removePendingUserMessage } from '../render-messages.js';

import type { EventHandlerContext } from './types.js';

export function handleAgentStart(ctx: EventHandlerContext): void {
  const { state } = ctx;
  state.goalManager.startActiveTimer();

  // Refresh git branch async to avoid blocking the event loop
  getCurrentGitBranchAsync(state.projectInfo.rootPath).then(freshBranch => {
    if (freshBranch) {
      state.projectInfo.gitBranch = freshBranch;
      ctx.updateStatusLine();
    }
  });

  if (!state.gradientAnimator) {
    state.gradientAnimator = new GradientAnimator(() => {
      ctx.updateStatusLine();
    });
  }
  state.gradientAnimator.start();
}

export function handleAgentEnd(ctx: EventHandlerContext): void {
  const { state } = ctx;
  // Stop the goal active-timer on normal completion too (not just abort/error),
  // otherwise the elapsed-time display keeps counting while idle between turns.
  state.goalManager.stopActiveTimer();
  if (state.gradientAnimator) {
    state.gradientAnimator.fadeOut();
  }

  // Refresh git branch async — tool calls during this turn may have switched branches
  getCurrentGitBranchAsync(state.projectInfo.rootPath).then(freshBranch => {
    if (freshBranch) {
      state.projectInfo.gitBranch = freshBranch;
      ctx.updateStatusLine();
    }
  });

  if (state.streamingComponent) {
    state.streamingComponent = undefined;
    state.streamingMessage = undefined;
  }
  // Drop the live judge reference so that a continuation turn creates a fresh
  // JudgeDisplayComponent *after* the new streaming text. Without this the
  // reused component stays at the position of the previous turn's evaluation,
  // causing the new turn's text to visually overwrite the old text + judge.
  state.activeGoalJudge = undefined;
  state.followUpComponents = [];
  state.pendingTools.clear();
  state.pendingTaskToolIds?.clear();
  pruneChatContainer(state);
  ctx.updateStatusLine();
  state.ui.requestRender();

  ctx.notify('agent_done');

  drainQueuedAction(ctx);
}

function drainQueuedAction(ctx: EventHandlerContext): boolean {
  const { state } = ctx;

  // Drain queued follow-up actions once all controller-level follow-ups are done.
  // Each queued action that starts a new agent operation will eventually trigger
  // handleAgentEnd again, which drains the next FIFO item.
  if (state.session.followUps.count() > 0) {
    return true;
  }

  // User-queued actions preempt the goal loop — if the user typed something
  // while the agent was running, process that first.
  const nextAction = state.pendingQueuedActions.shift();
  ctx.updateStatusLine();
  if (!nextAction) {
    return false;
  }

  if (nextAction === 'message') {
    const nextMessage = state.pendingFollowUpMessages.shift();
    if (!nextMessage) {
      return true;
    }

    ctx.addUserMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content: [
        { type: 'text', text: nextMessage.content },
        ...(nextMessage.images?.map(img => ({
          type: 'image' as const,
          data: img.data,
          mimeType: img.mimeType,
        })) ?? []),
      ],
      createdAt: new Date(),
    });
    // Track the text so the subscription echo is suppressed in addUserMessage.
    const key = nextMessage.content.trim();
    const counts = (state.firedQueuedMessageTexts ??= new Map<string, number>());
    counts.set(key, (counts.get(key) ?? 0) + 1);
    state.ui.requestRender();
    ctx.fireMessage(nextMessage.content, nextMessage.images);
    return true;
  }

  const nextCommand = state.pendingSlashCommands.shift();
  const pendingMessageId = state.pendingSlashCommandMessageIds.shift();
  if (!nextCommand) {
    if (pendingMessageId) {
      removePendingUserMessage(state, pendingMessageId);
    }
    return true;
  }

  if (pendingMessageId) {
    removePendingUserMessage(state, pendingMessageId);
  }
  ctx.handleSlashCommand(nextCommand).catch(error => {
    ctx.showError(error instanceof Error ? error.message : 'Queued slash command failed');
  });
  return true;
}

export function handleAgentAborted(ctx: EventHandlerContext): void {
  const { state } = ctx;
  state.goalManager.stopActiveTimer();
  if (state.gradientAnimator) {
    state.gradientAnimator.fadeOut();
  }

  // User-initiated aborts and plan "Request Changes" aborts are intentional.
  // The timing line already says "canceled after x", so don't also render a
  // redundant "Error: Interrupted" message in the transcript.
  if (state.planRejectionAbort || state.userInitiatedAbort) {
    state.streamingComponent = undefined;
    state.streamingMessage = undefined;
  } else if (state.streamingComponent && state.streamingMessage) {
    // Update unexpected aborted streams to show they were interrupted.
    state.streamingMessage.stopReason = 'aborted';
    state.streamingMessage.errorMessage = 'Interrupted';
    state.streamingComponent.updateContent(state.streamingMessage);
    state.streamingComponent = undefined;
    state.streamingMessage = undefined;
  }
  state.userInitiatedAbort = false;
  state.planRejectionAbort = false;
  if (state.activeGoalJudge) {
    removeJudgeComponent(state, state.activeGoalJudge.component);
    state.activeGoalJudge = undefined;
  }

  state.followUpComponents = [];
  state.pendingFollowUpMessages = [];
  state.pendingQueuedActions = [];
  state.pendingSlashCommands = [];
  state.pendingSlashCommandMessageIds = [];
  clearPendingUserMessages(state);
  state.pendingTools.clear();
  state.pendingTaskToolIds?.clear();
  pruneChatContainer(state);
  ctx.updateStatusLine();
  state.ui.requestRender();
}

export function handleAgentError(ctx: EventHandlerContext): void {
  const { state } = ctx;
  state.goalManager.stopActiveTimer();
  if (state.gradientAnimator) {
    state.gradientAnimator.fadeOut();
  }

  if (state.streamingComponent) {
    state.streamingComponent = undefined;
    state.streamingMessage = undefined;
  }
  if (state.activeGoalJudge) {
    removeJudgeComponent(state, state.activeGoalJudge.component);
    state.activeGoalJudge = undefined;
  }

  state.followUpComponents = [];
  state.pendingFollowUpMessages = [];
  state.pendingQueuedActions = [];
  state.pendingSlashCommands = [];
  state.pendingSlashCommandMessageIds = [];
  clearPendingUserMessages(state);
  state.pendingTools.clear();
  state.pendingTaskToolIds?.clear();
  pruneChatContainer(state);
  ctx.updateStatusLine();
  state.ui.requestRender();
}

// =============================================================================
// Goal Evaluation
// =============================================================================

/** Remove the judge display component from the chat container if present. */
function removeJudgeComponent(state: EventHandlerContext['state'], component: JudgeDisplayComponent): void {
  // Use the container's removal API so parent/layout bookkeeping stays
  // consistent, rather than splicing `children` directly.
  if (state.chatContainer.children.includes(component)) {
    state.chatContainer.removeChild(component);
  }
}

/**
 * Render an in-loop goal evaluation surfaced by the core goal step as a `goal`
 * stream chunk (bridged to a `goal_evaluation` controller event). The core loop
 * owns continuation — this handler only mirrors the judge's decision into the
 * UI, syncs the adapter's progress, and runs the plan-mode auto-switch when a
 * plan-started goal completes.
 */
export function handleGoalEvaluation(ctx: EventHandlerContext, payload: GoalEvaluationPayload): void {
  const { state } = ctx;

  // Esc/Ctrl+C pauses the goal and aborts the run. If a judge stream races in a
  // late goal chunk after that, don't let it recreate UI or overwrite the
  // user-paused objective with the stale active/continue result.
  if (state.userInitiatedAbort && state.goalManager.getGoal()?.status === 'paused') {
    return;
  }

  // Reuse the existing judge component for this turn, or create one inline so
  // the judge's progress appears alongside the agent's response.
  let activeGoalJudge = state.activeGoalJudge;
  if (!activeGoalJudge) {
    const goal = state.goalManager.getGoal();
    const component = new JudgeDisplayComponent(null, payload.iteration, payload.maxRuns);
    activeGoalJudge = {
      modelId: goal?.judgeModelId ?? '',
      abortController: new AbortController(),
      component,
    };
    state.activeGoalJudge = activeGoalJudge;
    insertChatComponentWithBoundarySpacing(state.chatContainer, component);
  }

  if (payload.activity?.length) {
    for (const activity of payload.activity) {
      if (activity.type === 'reason') {
        activeGoalJudge.component.setStreamingReason(activity.message);
      } else {
        activeGoalJudge.component.addActivity(activity.message);
      }
    }
  }

  // A pending chunk signals that scoring has started but isn't finished yet.
  // Show the loading indicator (the component already renders "evaluating…"
  // when result is null) and wait for the follow-up chunk with the result.
  if (payload.pending) {
    ctx.updateStatusLine();
    state.ui.requestRender();
    return;
  }

  activeGoalJudge.component.setEvaluation(payload);

  // Mirror the loop's progress into the synchronous adapter view so the status
  // line and modal reflect the latest run count and lifecycle status.
  state.goalManager.applyEvaluation({ runsUsed: payload.iteration, status: payload.status });

  ctx.updateStatusLine();
  state.ui.requestRender();

  // A final (non-pending) goal chunk completes this judge display. Keep the
  // rendered component in history, but drop the live reference so an in-loop
  // continuation creates a fresh display after the next assistant output instead
  // of updating the previous turn's component in place.
  state.activeGoalJudge = undefined;

  if (payload.status === 'done') {
    const goal = state.goalManager.getGoal();
    if (goal && goal.id === state.planStartedGoalId) {
      const goalId = state.planStartedGoalId;
      state.planStartedGoalId = undefined;
      state.session.mode.switch({ modeId: 'plan' }).catch(error => {
        ctx.showError(`Failed to switch to Plan mode: ${error instanceof Error ? error.message : String(error)}`);
        state.planStartedGoalId = goalId;
      });
    }
  }
}
