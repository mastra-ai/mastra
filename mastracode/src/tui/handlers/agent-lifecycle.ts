/**
 * Event handlers for agent lifecycle events:
 * agent_start, agent_end (normal / aborted / error).
 */
import { Spacer, Text } from '@mariozechner/pi-tui';

import { getCurrentGitBranch } from '../../utils/project.js';
import { GradientAnimator } from '../components/obi-loader.js';
import { theme } from '../theme.js';

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
  // Keep allToolComponents so Ctrl+E continues to work after agent completes

  ctx.notify('agent_done');

  // Drain queued slash commands once all harness-level follow-ups are done.
  // Each slash command that triggers sendMessage will start a new agent
  // operation, and handleAgentEnd will fire again to drain the next one.
  if (state.pendingSlashCommands.length > 0 && state.harness.getFollowUpCount() === 0) {
    const nextCommand = state.pendingSlashCommands.shift()!;
    ctx.handleSlashCommand(nextCommand).catch(error => {
      ctx.showError(error instanceof Error ? error.message : 'Queued slash command failed');
    });
  }
}

export function handleAgentAborted(ctx: EventHandlerContext): void {
  const { state } = ctx;
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
    state.chatContainer.addChild(new Spacer(1));
    state.chatContainer.addChild(new Text(theme.fg('error', 'Interrupted'), 1, 0));
  }
  state.userInitiatedAbort = false;

  state.followUpComponents = [];
  state.pendingSlashCommands = [];
  state.pendingTools.clear();
  // Keep allToolComponents so Ctrl+E continues to work after interruption
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
  state.pendingSlashCommands = [];
  state.pendingTools.clear();
  // Keep allToolComponents so Ctrl+E continues to work after errors
}
