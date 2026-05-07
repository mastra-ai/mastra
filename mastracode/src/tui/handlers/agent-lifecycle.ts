/**
 * Event handlers for agent lifecycle events:
 * agent_start, agent_end (normal / aborted / error).
 */
import { Spacer, Text } from '@mariozechner/pi-tui';

import { getCurrentGitBranch } from '../../utils/project.js';
import { JudgeDisplayComponent } from '../components/judge-display.js';
import { GradientAnimator } from '../components/obi-loader.js';
import { showInfo } from '../display.js';
import { pruneChatContainer } from '../prune-chat.js';
import { BOX_INDENT, theme } from '../theme.js';

import type { EventHandlerContext } from './types.js';

export function handleAgentStart(ctx: EventHandlerContext): void {
  const { state } = ctx;

  // Refresh git branch so status line reflects the current branch
  const freshBranch = getCurrentGitBranch(state.projectInfo.rootPath);
  if (freshBranch) {
    state.projectInfo.gitBranch = freshBranch;
  }

  if (!state.gradientAnimator) {
    state.gradientAnimator = new GradientAnimator(() => {
      ctx.updateStatusLine();
    });
  }
  state.gradientAnimator.start();
}

export function handleAgentEnd(ctx: EventHandlerContext): void {
  const { state } = ctx;
  if (state.gradientAnimator) {
    state.gradientAnimator.fadeOut();
  }

  // Refresh git branch — tool calls during this turn may have switched branches
  const freshBranch = getCurrentGitBranch(state.projectInfo.rootPath);
  if (freshBranch) {
    state.projectInfo.gitBranch = freshBranch;
  }

  if (state.streamingComponent) {
    state.streamingComponent = undefined;
    state.streamingMessage = undefined;
  }
  state.followUpComponents = [];
  state.pendingTools.clear();
  pruneChatContainer(state);
  ctx.updateStatusLine();
  state.ui.requestRender();

  ctx.notify('agent_done');

  if (drainQueuedAction(ctx)) {
    return;
  }

  maybeGoalContinuation(ctx);
}

function drainQueuedAction(ctx: EventHandlerContext): boolean {
  const { state } = ctx;

  // Drain queued follow-up actions once all harness-level follow-ups are done.
  // Each queued action that starts a new agent operation will eventually trigger
  // handleAgentEnd again, which drains the next FIFO item.
  if (state.harness.getFollowUpCount() > 0) {
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
    state.ui.requestRender();
    ctx.fireMessage(nextMessage.content, nextMessage.images);
    return true;
  }

  const nextCommand = state.pendingSlashCommands.shift();
  if (!nextCommand) {
    return true;
  }

  ctx.handleSlashCommand(nextCommand).catch(error => {
    ctx.showError(error instanceof Error ? error.message : 'Queued slash command failed');
  });
  return true;
}

export function handleAgentAborted(ctx: EventHandlerContext): void {
  const { state } = ctx;
  if (state.gradientAnimator) {
    state.gradientAnimator.fadeOut();
  }

  // Pause the goal loop on user-initiated abort
  if (state.userInitiatedAbort && state.goalManager.isActive()) {
    state.goalManager.pause();
    state.goalManager.saveToThread(state).catch(() => {});
    showInfo(state, 'Goal paused (interrupted). Use /goal resume to continue.');
  }

  // Update streaming message to show it was interrupted
  if (state.streamingComponent && state.streamingMessage) {
    state.streamingMessage.stopReason = 'aborted';
    state.streamingMessage.errorMessage = 'Interrupted';
    state.streamingComponent.updateContent(state.streamingMessage);
    state.streamingComponent = undefined;
    state.streamingMessage = undefined;
  } else if (state.userInitiatedAbort) {
    // Show standalone "Interrupted" if user pressed Ctrl+C but no streaming component
    state.chatContainer.addChild(new Text(theme.fg('error', 'Interrupted'), BOX_INDENT, 0));
    state.chatContainer.addChild(new Spacer(1));
  }
  state.userInitiatedAbort = false;

  state.followUpComponents = [];
  state.pendingFollowUpMessages = [];
  state.pendingQueuedActions = [];
  state.pendingSlashCommands = [];
  state.pendingTools.clear();
  pruneChatContainer(state);
  ctx.updateStatusLine();
  state.ui.requestRender();
}

export function handleAgentError(ctx: EventHandlerContext): void {
  const { state } = ctx;
  if (state.gradientAnimator) {
    state.gradientAnimator.fadeOut();
  }

  if (state.streamingComponent) {
    state.streamingComponent = undefined;
    state.streamingMessage = undefined;
  }

  state.followUpComponents = [];
  state.pendingFollowUpMessages = [];
  state.pendingQueuedActions = [];
  state.pendingSlashCommands = [];
  state.pendingTools.clear();
  pruneChatContainer(state);
  ctx.updateStatusLine();
  state.ui.requestRender();
}

// =============================================================================
// Goal Continuation
// =============================================================================

/**
 * After a completed agent turn with no queued user actions, evaluate
 * whether the standing goal is satisfied. If not, send a continuation
 * prompt to keep the agent working.
 */
function maybeGoalContinuation(ctx: EventHandlerContext): void {
  const { state } = ctx;
  if (!state.goalManager.isActive()) return;

  const goal = state.goalManager.getGoal();
  if (!goal) return;
  const evaluatedGoalId = goal.id;

  if (!state.gradientAnimator) {
    state.gradientAnimator = new GradientAnimator(() => {
      ctx.updateStatusLine();
    });
  }
  state.activeGoalJudge = { modelId: goal.judgeModelId };
  state.gradientAnimator.start();
  ctx.updateStatusLine();
  state.ui.requestRender();

  state.goalManager
    .evaluateAfterTurn(state)
    .then(async ({ continuation, judgeResult }) => {
      // Display the judge result in chat if available
      if (judgeResult) {
        const goal = state.goalManager.getGoal()!;
        const judgeComponent = new JudgeDisplayComponent(judgeResult, goal.turnsUsed, goal.maxTurns);
        state.chatContainer.addChild(judgeComponent);
        state.ui.requestRender();
      }

      if (continuation) {
        const currentGoal = state.goalManager.getGoal();
        if (currentGoal?.id !== evaluatedGoalId || currentGoal.status !== 'active') {
          return;
        }
        if (drainQueuedAction(ctx)) {
          return;
        }
        ctx.fireMessage(continuation);
      } else {
        // Goal is done, paused, or waiting at an explicit checkpoint. Persist the final
        // judge response so the conversation history survives reloads.
        const goal = state.goalManager.getGoal();
        if (goal && judgeResult) {
          const harness = state.harness as typeof state.harness & {
            saveSystemReminderMessage?: (args: { reminderType: string; message: string }) => Promise<unknown>;
          };
          await harness.saveSystemReminderMessage?.({
            reminderType: 'goal-judge',
            message: `${judgeResult.decision} (${goal.turnsUsed}/${goal.maxTurns})\n${judgeResult.reason}`,
          });
        }
        if (goal?.status === 'paused') {
          showInfo(state, `Goal paused (attempt ${goal.turnsUsed}/${goal.maxTurns}). Use /goal resume to continue.`);
        }
      }
    })
    .catch(() => {
      // Goal evaluation failed — don't block the TUI
    })
    .finally(() => {
      state.activeGoalJudge = undefined;
      state.gradientAnimator?.fadeOut();
      ctx.updateStatusLine();
      state.ui.requestRender();
    });
}
