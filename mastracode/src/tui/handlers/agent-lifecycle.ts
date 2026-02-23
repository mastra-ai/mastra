/**
 * Event handlers for agent lifecycle events:
 * agent_start, agent_end (normal / aborted / error).
 */
import { Spacer, Text } from '@mariozechner/pi-tui';

import { GradientAnimator } from '../components/obi-loader.js';
import { theme } from '../theme.js';

import type { EventHandlerContext } from './types.js';

export function handleAgentStart(ctx: EventHandlerContext): void {
  const { state } = ctx;
  state.isAgentActive = true;
  if (!state.gradientAnimator) {
    state.gradientAnimator = new GradientAnimator(() => {
      ctx.updateStatusLine();
    });
  }
  state.gradientAnimator.start();
  ctx.updateStatusLine();
}

export function handleAgentEnd(ctx: EventHandlerContext): void {
  const { state } = ctx;
  state.isAgentActive = false;
  if (state.gradientAnimator) {
    state.gradientAnimator.fadeOut();
  }
  ctx.updateStatusLine();

  if (state.streamingComponent) {
    state.streamingComponent = undefined;
    state.streamingMessage = undefined;
  }
  state.followUpComponents = [];
  state.pendingTools.clear();
  state.toolInputBuffers.clear();
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
  state.isAgentActive = false;
  if (state.gradientAnimator) {
    state.gradientAnimator.fadeOut();
  }
  ctx.updateStatusLine();

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
  state.toolInputBuffers.clear();
  // Keep allToolComponents so Ctrl+E continues to work after interruption
  state.ui.requestRender();
}

export function handleAgentError(ctx: EventHandlerContext): void {
  const { state } = ctx;
  state.isAgentActive = false;
  if (state.gradientAnimator) {
    state.gradientAnimator.fadeOut();
  }
  ctx.updateStatusLine();

  if (state.streamingComponent) {
    state.streamingComponent = undefined;
    state.streamingMessage = undefined;
  }

  state.followUpComponents = [];
  state.pendingSlashCommands = [];
  state.pendingTools.clear();
  state.toolInputBuffers.clear();
  // Keep allToolComponents so Ctrl+E continues to work after errors
}
