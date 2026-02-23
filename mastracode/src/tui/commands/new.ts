import type { SlashCommandContext } from './types.js';

export function handleNewCommand(ctx: SlashCommandContext): void {
  const { state } = ctx;

  state.pendingNewThread = true;
  state.chatContainer.clear();
  state.pendingTools.clear();
  state.toolInputBuffers.clear();
  state.allToolComponents = [];
  // Clear file tracking in display state (thread_created will also reset this)
  state.harness.getDisplayState().modifiedFiles.clear();
  if (state.taskProgress) {
    state.taskProgress.updateTasks([]);
  }
  state.previousTasks = [];
  state.taskWriteInsertIndex = -1;

  ctx.resetStatusLineState();
  state.ui.requestRender();
  ctx.showInfo('Ready for new conversation');
}
