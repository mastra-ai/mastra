import { Spacer } from '@mariozechner/pi-tui';
import { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import type { TUIState } from '../state.js';
import type { SlashCommandContext } from './types.js';

/** Minimal interface accepted by resetUIAfterClone so it works from both
 *  slash-command handlers (SlashCommandContext) and the MastraTUI class. */
interface CloneResetContext {
  state: TUIState;
  updateStatusLine: () => void;
  renderExistingMessages: () => Promise<void>;
  showInfo: (message: string) => void;
}

/**
 * Confirm whether the user wants to clone a thread. Returns true if
 * confirmed, false on cancel or "No".
 */
export function confirmClone(state: TUIState, threadLabel?: string): Promise<boolean> {
  const label = threadLabel ? `Clone thread "${threadLabel}"?` : 'Clone the current thread?';
  return new Promise<boolean>(resolve => {
    const question = new AskQuestionInlineComponent(
      {
        question: label,
        options: [
          { label: 'Yes', description: 'Clone this thread' },
          { label: 'No', description: 'Cancel' },
        ],
        formatResult: answer => (answer === 'Yes' ? 'Cloning thread...' : 'Cancelled.'),
        isNegativeAnswer: answer => answer !== 'Yes',
        onSubmit: answer => {
          state.activeInlineQuestion = undefined;
          resolve(answer === 'Yes');
        },
        onCancel: () => {
          state.activeInlineQuestion = undefined;
          resolve(false);
        },
      },
      state.ui,
    );

    state.activeInlineQuestion = question;
    state.chatContainer.addChild(question);
    state.chatContainer.addChild(new Spacer(1));
    state.ui.requestRender();
    state.chatContainer.invalidate();
  });
}

/**
 * Prompt for an optional clone name. Returns the trimmed name, or null
 * if the user presses Esc or submits an empty string.
 */
export function askCloneName(state: TUIState): Promise<string | null> {
  return new Promise<string | null>(resolve => {
    const question = new AskQuestionInlineComponent(
      {
        question: 'Give the cloned thread a name? (Esc to skip)',
        formatResult: answer => `Thread name: ${answer}`,
        onSubmit: answer => {
          state.activeInlineQuestion = undefined;
          const trimmed = answer.trim();
          resolve(trimmed.length > 0 ? trimmed : null);
        },
        onCancel: () => {
          state.activeInlineQuestion = undefined;
          resolve(null);
        },
      },
      state.ui,
    );

    state.activeInlineQuestion = question;
    state.chatContainer.addChild(question);
    state.chatContainer.addChild(new Spacer(1));
    state.ui.requestRender();
    state.chatContainer.invalidate();
  });
}

/**
 * Shared post-clone UI reset: clears chat, tools, tasks, re-renders messages,
 * and shows an info banner. Every clone path should call this after
 * `harness.cloneThread()` succeeds.
 */
export async function resetUIAfterClone(ctx: CloneResetContext, clonedTitle: string): Promise<void> {
  const { state } = ctx;
  state.chatContainer.clear();
  state.pendingTools.clear();
  state.allToolComponents = [];
  state.allSystemReminderComponents = [];
  state.messageComponentsById.clear();
  state.allShellComponents = [];
  state.harness.getDisplayState().modifiedFiles.clear();
  // Clear per-thread ephemeral state from the global harness state
  await state.harness.setState({ tasks: [], activePlan: null, sandboxAllowedPaths: [] });
  if (state.taskProgress) {
    state.taskProgress.updateTasks([]);
  }
  state.taskWriteInsertIndex = -1;

  ctx.updateStatusLine();
  await ctx.renderExistingMessages();
  state.ui.requestRender();
  ctx.showInfo(`Cloned thread: ${clonedTitle}`);
}

export async function handleCloneCommand(ctx: SlashCommandContext): Promise<void> {
  const { state } = ctx;

  const currentThreadId = state.harness.getCurrentThreadId();
  if (!currentThreadId) {
    ctx.showInfo('No active thread to clone');
    return;
  }

  // Step 1: Confirm / Cancel
  if (!(await confirmClone(state))) return;

  // Step 2: Optional rename
  const customTitle = await askCloneName(state);

  try {
    const clonedThread = await state.harness.cloneThread({
      sourceThreadId: currentThreadId,
      ...(customTitle ? { title: customTitle } : {}),
    });

    await resetUIAfterClone(ctx, clonedThread.title || clonedThread.id);
  } catch (error) {
    ctx.showError(`Failed to clone thread: ${error instanceof Error ? error.message : String(error)}`);
  }
}
