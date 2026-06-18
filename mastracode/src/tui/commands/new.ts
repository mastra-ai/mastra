import type { SlashCommandContext } from './types.js';

export async function handleNewCommand(ctx: SlashCommandContext): Promise<void> {
  const { state } = ctx;

  // Detach from the old thread's event stream so cross-process events
  // don't leak into the new conversation. Unlike bare abort(), this also
  // unsubscribes from the PubSub topic — preventing another mc instance
  // on the same thread from pushing output into this TUI.
  state.harness.detachFromCurrentThread();

  state.pendingNewThread = true;
  state.chatContainer.clear();
  state.pendingTools.clear();
  state.pendingTaskToolIds?.clear();
  state.allToolComponents = [];
  state.allSlashCommandComponents = [];
  state.allSystemReminderComponents = [];
  state.messageComponentsById.clear();
  state.allShellComponents = [];
  // Clear file tracking in display state (thread_created will also reset this)
  state.harness.getDisplayState().modifiedFiles.clear();
  // Clear per-thread ephemeral state from the global harness state
  await state.harness.session.state.set({ tasks: [], activePlan: null, sandboxAllowedPaths: [] });
  if (state.taskProgress) {
    state.taskProgress.updateTasks([]);
  }
  state.taskToolInsertIndex = -1;

  ctx.updateStatusLine();
  state.ui.requestRender();
  ctx.showInfo('Ready for new conversation');
}
