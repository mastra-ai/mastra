import { disposeAssistantRenderState } from '../assistant-render-registry.js';
import { setCurrentThreadTitle } from '../thread-title.js';
import type { SlashCommandContext } from './types.js';

export async function handleNewCommand(ctx: SlashCommandContext): Promise<void> {
  const { state } = ctx;

  // Detach from the old thread's event stream so cross-process events
  // don't leak into the new conversation. Unlike a bare abort(), this also
  // unsubscribes from the PubSub topic — preventing another mc instance
  // on the same thread from pushing output into this TUI — and its abort
  // stays local, so another instance running the thread keeps its run.
  state.session.thread.detachFromCurrent();

  state.pendingNewThread = true;
  state.globalBackgroundNotice.setActivities([]);
  setCurrentThreadTitle(state, undefined);
  disposeAssistantRenderState(state);
  // The thread being left may be owned by another instance: detaching then
  // produces no local agent_end to stop the run animation, so the sweep would
  // keep pulsing over an empty conversation. Clear the run-scoped status state
  // here, which also covers the local case before its late agent_end lands
  // (fadeOut() on a stopped animator is a no-op).
  state.gradientAnimator?.stop();
  state.githubPrGradientAnimator?.stop();
  state.githubPrPollingActive = false;
  state.agentRunStartedAt = undefined;
  state.agentRunLastStreamPartAt = undefined;
  state.chatContainer.clear();
  state.pendingTools.clear();
  state.pendingTaskToolIds?.clear();
  state.pendingSubagents.clear();
  state.pendingSignalMessageComponentsById.clear();
  state.followUpComponents = [];
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
