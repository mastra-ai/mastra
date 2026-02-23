import type { SlashCommandContext } from './types.js';

export function handleNewCommand(ctx: SlashCommandContext): void {
  const { state } = ctx;

  state.pendingNewThread = true;
  state.chatContainer.clear();
  state.pendingTools.clear();
  state.toolInputBuffers.clear();
  state.allToolComponents = [];
  state.modifiedFiles.clear();
  state.pendingFileTools.clear();
  if (state.taskProgress) {
    state.taskProgress.updateTasks([]);
  }
  state.previousTasks = [];
  state.taskWriteInsertIndex = -1;

  ctx.resetStatusLineState();
  state.ui.requestRender();
  ctx.showInfo('Ready for new conversation');
}
