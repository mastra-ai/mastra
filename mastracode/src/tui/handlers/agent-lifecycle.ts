/**
 * Event handlers for agent lifecycle events:
 * agent_start, agent_end (normal / aborted / error).
 */
import { Spacer, Text } from '@mariozechner/pi-tui';

import { getCurrentGitBranchAsync } from '../../utils/project.js';
import { JudgeDisplayComponent } from '../components/judge-display.js';
import { GradientAnimator } from '../components/obi-loader.js';
import { showInfo } from '../display.js';
import { pruneChatContainer } from '../prune-chat.js';
import { clearPendingUserMessages, removePendingUserMessage } from '../render-messages.js';
import { BOX_INDENT, theme } from '../theme.js';

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
  state.followUpComponents = [];
  state.pendingTools.clear();
  state.pendingTaskToolIds?.clear();
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
// Goal Continuation
// =============================================================================

/**
 * After a completed agent turn with no queued user actions, evaluate
 * whether the standing goal is satisfied. If not, send a continuation
 * prompt to keep the agent working.
 */
function removeJudgeComponent(state: EventHandlerContext['state'], component: JudgeDisplayComponent): void {
  const children = state.chatContainer.children;
  const index = children.indexOf(component);
  if (index >= 0) {
    children.splice(index, 1);
    state.chatContainer.invalidate?.();
  }
}

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
  const abortController = new AbortController();
  const judgeComponent = new JudgeDisplayComponent(null, goal.turnsUsed, goal.maxTurns);
  const activeGoalJudge = { modelId: goal.judgeModelId, abortController, component: judgeComponent };
  state.activeGoalJudge = activeGoalJudge;
  state.chatContainer.addChild(judgeComponent);
  state.gradientAnimator.start();
  ctx.updateStatusLine();
  state.ui.requestRender();

  state.goalManager
    .evaluateAfterTurn(state, {
      abortSignal: abortController.signal,
      onActivity: line => {
        if (state.activeGoalJudge === activeGoalJudge) {
          judgeComponent.addActivity(line);
          state.ui.requestRender();
        }
      },
    })
    .then(async ({ continuation, judgeResult }) => {
      if (state.activeGoalJudge !== activeGoalJudge) {
        return;
      }

      const currentGoal = state.goalManager.getGoal();
      if (!currentGoal || currentGoal.id !== evaluatedGoalId) {
        removeJudgeComponent(state, judgeComponent);
        return;
      }

      if (judgeResult) {
        judgeComponent.setResult(judgeResult, currentGoal.turnsUsed, currentGoal.maxTurns);
        state.ui.requestRender();
      }

      if (abortController.signal.aborted) {
        state.userInitiatedAbort = false;
        return;
      }

      if (continuation) {
        if (currentGoal.status !== 'active') {
          return;
        }
        if (drainQueuedAction(ctx)) {
          return;
        }
        try {
          await state.harness.sendSignal({
            type: 'system-reminder',
            contents: continuation,
            attributes: { type: 'goal-judge' },
            metadata: {
              goalId: currentGoal.id,
              turnsUsed: currentGoal.turnsUsed,
              maxTurns: currentGoal.maxTurns,
              judgeModelId: currentGoal.judgeModelId,
            },
          }).accepted;
        } catch (error) {
          ctx.showError(`Failed to send goal continuation: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        // Goal is done, paused, or waiting at an explicit checkpoint. Persist the final
        // judge response so the conversation history survives reloads.
        if (judgeResult) {
          const harness = state.harness as typeof state.harness & {
            saveSystemReminderMessage?: (args: { reminderType: string; message: string }) => Promise<unknown>;
          };
          await harness.saveSystemReminderMessage?.({
            reminderType: 'goal-judge',
            message: `${judgeResult.decision} (${currentGoal.turnsUsed}/${currentGoal.maxTurns})\n${judgeResult.reason}`,
          });
        }
        if (currentGoal.status === 'paused') {
          showInfo(
            state,
            `Goal paused (attempt ${currentGoal.turnsUsed}/${currentGoal.maxTurns}). Use /goal resume to continue.`,
          );
        }

        if (judgeResult?.decision === 'done' && currentGoal.id === state.planStartedGoalId) {
          const goalId = state.planStartedGoalId;
          state.planStartedGoalId = undefined;
          try {
            await state.harness.switchMode({ modeId: 'plan' });
          } catch (error) {
            ctx.showError(`Failed to switch to Plan mode: ${error instanceof Error ? error.message : String(error)}`);
            state.planStartedGoalId = goalId;
          }
        }
      }
    })
    .catch(() => {
      // Goal evaluation failed — don't block the TUI
    })
    .finally(() => {
      if (state.activeGoalJudge === activeGoalJudge) {
        state.activeGoalJudge = undefined;
      }
      state.gradientAnimator?.fadeOut();
      ctx.updateStatusLine();
      state.ui.requestRender();
    });
}
