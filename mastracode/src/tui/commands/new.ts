import type { SlashCommandContext } from './types.js';

export function handleNewCommand(ctx: SlashCommandContext): void {
  const { state } = ctx;

  state.pendingNewThread = true;
  state.chatContainer.clear();
  state.pendingTools.clear();
  state.allToolComponents = [];
  state.allSystemReminderComponents = [];
  // Clear file tracking in display state (thread_created will also reset this)
  state.harness.getDisplayState().modifiedFiles.clear();
  if (state.taskProgress) {
    state.taskProgress.updateTasks([]);
  }
  state.taskWriteInsertIndex = -1;
  // Clear harness state tasks + active plan so they don't leak into the new thread's system prompt
  void state.harness.setState({ tasks: [], activePlan: null } as any);

  ctx.updateStatusLine();
  state.ui.requestRender();
  ctx.showInfo('Ready for new conversation');
}
