import { disposeAssistantRenderState } from '../assistant-render-registry.js';
import { EXPLICIT_NEW_THREAD_SETTING } from '../thread-startup.js';
import { setCurrentThreadTitle } from '../thread-title.js';
import type { SlashCommandContext } from './types.js';

export async function handleNewCommand(ctx: SlashCommandContext): Promise<void> {
  const { state } = ctx;
  const previousThreadId = state.session.thread.getId();

  // Detach from the old thread's event stream so cross-process events
  // don't leak into the new conversation. Unlike bare abort(), this also
  // unsubscribes from the PubSub topic — preventing another mc instance
  // on the same thread from pushing output into this TUI.
  state.session.thread.detachFromCurrent();

  // `/new` is an explicit request for a durable thread, even if the user exits
  // before sending its first message. Mark it so startup cleanup can distinguish
  // it from the disposable blank thread created during controller bootstrap.
  try {
    await state.session.thread.create({ metadata: { [EXPLICIT_NEW_THREAD_SETTING]: true } });
  } catch (error) {
    try {
      const currentThreadId = state.session.thread.getId();
      if (currentThreadId !== previousThreadId) {
        if (previousThreadId) {
          await state.session.thread.switch({ threadId: previousThreadId });
        } else {
          await state.session.thread.clearAndReleaseLock();
        }
      } else {
        await state.session.thread.ensureCurrentSubscription();
      }
    } catch {
      // Preserve the thread creation error if restoring the old binding fails.
    }
    throw error;
  }
  state.pendingNewThread = false;
  setCurrentThreadTitle(state, undefined);
  disposeAssistantRenderState(state);
  state.chatContainer.clear();
  state.pendingTools.clear();
  state.pendingTaskToolIds?.clear();
  state.allToolComponents = [];
  state.allSlashCommandComponents = [];
  state.allSystemReminderComponents = [];
  state.messageComponentsById.clear();
  state.allShellComponents = [];
  // Clear file tracking in display state (thread_created will also reset this)
  state.session.displayState.get().modifiedFiles.clear();
  // Clear per-thread ephemeral state from the global controller state
  await state.session.state.set({ tasks: [], activePlan: null, sandboxAllowedPaths: [] });
  state.previousPlanSnapshot = undefined;
  if (state.taskProgress) {
    state.taskProgress.updateTasks([]);
  }
  state.taskToolInsertIndex = -1;

  ctx.updateStatusLine();
  state.ui.requestRender();
  ctx.showInfo('Ready for new conversation');
}
