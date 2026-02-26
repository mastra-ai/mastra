import type { SlashCommandContext } from './types.js';

export async function handleCloneCommand(ctx: SlashCommandContext): Promise<void> {
  const { state } = ctx;

  const currentThreadId = state.harness.getCurrentThreadId();
  if (!currentThreadId) {
    ctx.showInfo('No active thread to clone');
    return;
  }

  try {
    const clonedThread = await state.harness.cloneThread({ sourceThreadId: currentThreadId });

    state.chatContainer.clear();
    state.pendingTools.clear();
    state.allToolComponents = [];
    state.harness.getDisplayState().modifiedFiles.clear();
    if (state.taskProgress) {
      state.taskProgress.updateTasks([]);
    }
    state.taskWriteInsertIndex = -1;

    ctx.updateStatusLine();
    await ctx.renderExistingMessages();
    state.ui.requestRender();
    ctx.showInfo(`Cloned thread: ${clonedThread.title || clonedThread.id}`);
  } catch (error) {
    ctx.showError(`Failed to clone thread: ${error instanceof Error ? error.message : String(error)}`);
  }
}
