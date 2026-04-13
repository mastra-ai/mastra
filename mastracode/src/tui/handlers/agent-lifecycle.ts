/**
 * Event handlers for agent lifecycle events:
 * agent_start, agent_end (normal / aborted / error).
 */
import { Spacer, Text } from '@mariozechner/pi-tui';

import { getCurrentGitBranch } from '../../utils/project.js';
import { GradientAnimator } from '../components/obi-loader.js';
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

  // Drain queued follow-up actions once all harness-level follow-ups are done.
  // Each queued action that starts a new agent operation will eventually trigger
  // handleAgentEnd again, which drains the next FIFO item.
  if (state.harness.getFollowUpCount() > 0) {
    return;
  }

  const nextAction = state.pendingQueuedActions.shift();
  ctx.updateStatusLine();
  if (!nextAction) {
    return;
  }

  if (nextAction === 'message') {
    const nextMessage = state.pendingFollowUpMessages.shift();
    if (!nextMessage) {
      return;
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
    return;
  }

  const nextCommand = state.pendingSlashCommands.shift();
  if (!nextCommand) {
    return;
  }

  ctx.handleSlashCommand(nextCommand).catch(error => {
    ctx.showError(error instanceof Error ? error.message : 'Queued slash command failed');
  });
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
