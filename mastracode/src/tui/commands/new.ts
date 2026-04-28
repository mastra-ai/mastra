import type { SlashCommandContext } from './types.js';

export async function handleNewCommand(ctx: SlashCommandContext): Promise<void> {
  const { state } = ctx;

  state.pendingNewThread = true;
  state.chatContainer.clear();
  state.pendingTools.clear();
  state.allToolComponents = [];
  state.allSlashCommandComponents = [];
  state.allSystemReminderComponents = [];
  state.messageComponentsById.clear();
  state.allShellComponents = [];
  // Clear file tracking in display state (thread_created will also reset this)
  state.harness.getDisplayState().modifiedFiles.clear();
  // Clear per-thread ephemeral state from the global harness state
  await state.harness.setState({ tasks: [], activePlan: null, sandboxAllowedPaths: [] });
  if (state.taskProgress) {
    state.taskProgress.updateTasks([]);
  }
  state.taskWriteInsertIndex = -1;

  ctx.updateStatusLine();
  state.ui.requestRender();
  ctx.showInfo('Ready for new conversation');
}
