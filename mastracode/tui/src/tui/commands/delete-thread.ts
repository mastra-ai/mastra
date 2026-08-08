import { askModalQuestion } from '../modal-question.js';
import type { TUIState } from '../state.js';

/** Minimal interface accepted by resetUIAfterCurrentThreadDelete so it works
 *  from both slash-command handlers (SlashCommandContext) and the MastraTUI class. */
interface DeleteResetContext {
  state: TUIState;
  updateStatusLine: () => void;
}

/**
 * Confirm whether the user wants to permanently delete a thread. Returns true
 * if confirmed, false on cancel.
 */
export async function confirmDeleteThread(state: TUIState, threadLabel: string): Promise<boolean> {
  const answer = await askModalQuestion(state.ui, {
    question: `Delete thread "${threadLabel}"? This cannot be undone.`,
    options: [
      { label: 'Delete', description: 'Permanently delete this thread' },
      { label: 'Cancel', description: 'Keep the thread' },
    ],
  });
  return answer === 'Delete';
}

/**
 * UI reset after deleting the *current* thread. The session has already
 * released the lock and cleared the thread binding
 * (`session.thread.delete()`), so the TUI mirrors `/new`: clear the chat and
 * per-thread ephemeral state, then defer thread creation until the next
 * message.
 */
export async function resetUIAfterCurrentThreadDelete(ctx: DeleteResetContext): Promise<void> {
  const { state } = ctx;
  state.pendingNewThread = true;
  state.chatContainer.clear();
  state.pendingTools.clear();
  state.pendingTaskToolIds?.clear();
  state.allToolComponents = [];
  state.allSlashCommandComponents = [];
  state.allSystemReminderComponents = [];
  state.messageComponentsById.clear();
  state.allShellComponents = [];
  state.session.displayState.clearModifiedFiles();
  // Clear per-thread ephemeral state from the global controller state
  await state.session.state.set({ tasks: [], activePlan: null, sandboxAllowedPaths: [] });
  state.previousPlanSnapshot = undefined;
  if (state.taskProgress) {
    state.taskProgress.updateTasks([]);
  }
  state.taskToolInsertIndex = -1;

  ctx.updateStatusLine();
  state.ui.requestRender();
}
