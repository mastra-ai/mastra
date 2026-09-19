import { ThreadLockError } from '@mastra/code-sdk/utils/thread-lock';
import { disposeAssistantRenderState } from '../assistant-render-registry.js';
import { askModalQuestion } from '../modal-question.js';
import { resetUIAfterClone } from './clone.js';
import type { SlashCommandContext } from './types.js';

function isBranchingUnsupported(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { id?: unknown }).id === 'BRANCHING_UNSUPPORTED';
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Switch to another thread and re-render it, mirroring the /threads selector
 * switch flow (same-container cleanup + renderExistingMessages).
 */
async function switchToThread(ctx: SlashCommandContext, threadId: string, banner: string): Promise<void> {
  const { state } = ctx;
  try {
    await state.session.thread.switch({ threadId });
    if (state.options.backgroundToolsEnabled) {
      await state.waitForAgentControllerEvents?.();
    }
  } catch (error) {
    if (error instanceof ThreadLockError) {
      ctx.showError(`Thread is locked by pid ${error.ownerPid}`);
    } else {
      ctx.showError(`Failed to switch thread: ${describeError(error)}`);
    }
    return;
  }
  state.pendingNewThread = false;

  disposeAssistantRenderState(state);
  state.chatContainer.clear();
  state.allToolComponents = [];
  state.allSystemReminderComponents = [];
  state.messageComponentsById.clear();
  state.allShellComponents = [];
  state.pendingTools.clear();
  state.pendingTaskToolIds?.clear();
  await ctx.renderExistingMessages();

  ctx.showInfo(banner);
}

/**
 * /branch — fork the current thread at its latest message into a shared-history
 * branch and switch to it.
 */
export async function handleBranchCommand(ctx: SlashCommandContext): Promise<void> {
  const { state } = ctx;

  const currentThreadId = state.session.thread.getId();
  if (!currentThreadId) {
    ctx.showInfo('No active thread to branch');
    return;
  }

  const messages = await state.session.thread.listActiveMessages({ limit: 1 });
  const forkMessage = messages[messages.length - 1];
  if (!forkMessage) {
    ctx.showInfo('No messages to branch from yet');
    return;
  }

  const answer = await askModalQuestion(state.ui, {
    question: 'Branch the current thread from this point?',
    options: [
      { label: 'Yes', description: 'Create a shared-history branch' },
      { label: 'No', description: 'Cancel' },
    ],
  });
  if (answer !== 'Yes') return;

  const nameAnswer = await askModalQuestion(state.ui, { question: 'Give the branch a name? (Esc to skip)' });
  const customTitle = nameAnswer?.trim() || null;

  try {
    const result = await state.session.thread.branch({
      branchPointMessageId: forkMessage.id,
      ...(customTitle ? { title: customTitle } : {}),
    });
    state.pendingNewThread = false;
    const label = result.thread.title || result.thread.id;
    await resetUIAfterClone(ctx, label, `Branched thread: ${label}`);
  } catch (error) {
    if (isBranchingUnsupported(error)) {
      ctx.showInfo('Thread branching is not supported by this memory configuration');
    } else {
      ctx.showError(`Failed to branch thread: ${describeError(error)}`);
    }
  }
}

/**
 * /parent — navigate from a branch thread back to the thread it forked from.
 */
export async function handleParentCommand(ctx: SlashCommandContext): Promise<void> {
  const { state } = ctx;

  if (!state.session.thread.getId()) {
    ctx.showInfo('No active thread');
    return;
  }

  let parent;
  try {
    parent = await state.session.thread.getParent();
  } catch (error) {
    ctx.showError(`Failed to load parent thread: ${describeError(error)}`);
    return;
  }

  if (!parent) {
    ctx.showInfo('Current thread is not a branch');
    return;
  }

  await switchToThread(ctx, parent.id, `Switched to parent: ${parent.title || parent.id}`);
}

/**
 * /branches — list branches forked from the current thread and jump to one.
 */
export async function handleBranchesCommand(ctx: SlashCommandContext): Promise<void> {
  const { state } = ctx;

  const currentThreadId = state.session.thread.getId();
  if (!currentThreadId) {
    ctx.showInfo('No active thread');
    return;
  }

  let branches;
  try {
    ({ branches } = await state.session.thread.listBranches({ perPage: false }));
  } catch (error) {
    ctx.showError(`Failed to list branches: ${describeError(error)}`);
    return;
  }

  if (branches.length === 0) {
    ctx.showInfo('No branches forked from this thread');
    return;
  }

  const cancelLabel = 'Cancel';
  const answer = await askModalQuestion(state.ui, {
    question: `Branches of this thread (${branches.length}):`,
    options: [
      ...branches.map(entry => ({
        label: entry.thread.title || entry.thread.id,
        description: `Forked at ${new Date(entry.branch.branchCreatedAt).toLocaleString()}`,
      })),
      { label: cancelLabel, description: 'Stay on this thread' },
    ],
  });
  if (!answer || answer === cancelLabel) return;

  const selected = branches.find(entry => (entry.thread.title || entry.thread.id) === answer);
  if (!selected) return;

  await switchToThread(ctx, selected.thread.id, `Switched to branch: ${selected.thread.title || selected.thread.id}`);
}
