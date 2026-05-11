import { ThreadLockError } from '../../utils/thread-lock.js';
import { ThreadSelectorComponent } from '../components/thread-selector.js';
import { askModalQuestion } from '../modal-question.js';
import { showModalOverlay } from '../overlay.js';
import { askCloneName, confirmClone, resetUIAfterClone } from './clone.js';
import type { SlashCommandContext } from './types.js';

export function showThreadLockPrompt(
  ctx: SlashCommandContext,
  threadTitle: string,
  ownerPid: number,
  lockedThreadId?: string,
): void {
  void (async () => {
    const answer = await askModalQuestion(ctx.state.ui, {
      question: `Thread "${threadTitle}" is locked by pid ${ownerPid}. What would you like to do?`,
      options: [
        { label: 'Switch thread', description: 'Pick a different thread' },
        { label: 'New thread', description: 'Start a fresh thread' },
        ...(lockedThreadId ? [{ label: 'Clone thread', description: 'Fork from this thread' }] : []),
        { label: 'Exit', description: 'Exit' },
      ],
    });

    if (answer === 'Switch thread') {
      await handleThreadsCommand(ctx);
    } else if (answer === 'Clone thread' && lockedThreadId) {
      try {
        const customTitle = await askCloneName(ctx.state);
        const clonedThread = await ctx.state.harness.cloneThread({
          sourceThreadId: lockedThreadId,
          ...(customTitle ? { title: customTitle } : {}),
        });
        ctx.state.pendingNewThread = false;
        await resetUIAfterClone(ctx, clonedThread.title || clonedThread.id);
      } catch (error) {
        ctx.showError(`Failed to clone thread: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else if (answer === 'New thread') {
      // pendingNewThread is already true from the caller
    } else {
      process.exit(0);
    }
  })();
}

export async function handleThreadsCommand(ctx: SlashCommandContext): Promise<void> {
  const { state } = ctx;
  const threads = await state.harness.listThreads({ allResources: true });
  const currentId = state.pendingNewThread ? null : state.harness.getCurrentThreadId();
  const currentResourceId = state.harness.getResourceId();
  const threadById = new Map(threads.map(thread => [thread.id, thread] as const));

  for (const [threadId, cachedPreview] of [...state.threadPreviewCache.entries()]) {
    const thread = threadById.get(threadId);
    if (!thread || cachedPreview.updatedAt < thread.updatedAt.getTime()) {
      state.threadPreviewCache.delete(threadId);
      state.attemptedThreadPreviewIds.delete(threadId);
    }
  }

  for (const threadId of [...state.attemptedThreadPreviewIds]) {
    if (!threadById.has(threadId)) {
      state.attemptedThreadPreviewIds.delete(threadId);
    }
  }

  if (threads.length === 0) {
    ctx.showInfo('No threads yet. Send a message to create one.');
    return;
  }

  return new Promise(resolve => {
    const selector = new ThreadSelectorComponent({
      tui: state.ui,
      threads,
      currentThreadId: currentId,
      currentResourceId,
      currentProjectPath: state.projectInfo.rootPath,
      initialMessagePreviews: new Map(
        [...state.threadPreviewCache.entries()].map(
          ([threadId, cachedPreview]) => [threadId, cachedPreview.preview] as const,
        ),
      ),
      initialAttemptedPreviewThreadIds: state.attemptedThreadPreviewIds,
      onMessagePreviewsLoaded: (previews, attemptedThreadIds) => {
        state.threadPreviewCache = new Map(
          [...previews.entries()].flatMap(([threadId, preview]) => {
            const thread = threadById.get(threadId);
            return thread ? [[threadId, { preview, updatedAt: thread.updatedAt.getTime() }] as const] : [];
          }),
        );
        state.attemptedThreadPreviewIds = attemptedThreadIds;
      },
      getMessagePreviews: async (threadIds: string[]) => {
        return new Map(
          threadIds.flatMap(threadId => {
            const preview = state.threadPreviewCache.get(threadId)?.preview;
            return preview ? [[threadId, preview] as const] : [];
          }),
        );
      },
      onSelect: async thread => {
        state.ui.hideOverlay();

        if (thread.id === currentId) {
          resolve();
          return;
        }

        if (thread.resourceId !== currentResourceId) {
          state.harness.setResourceId({ resourceId: thread.resourceId });
        }
        try {
          await state.harness.switchThread({ threadId: thread.id });
        } catch (error) {
          if (error instanceof ThreadLockError) {
            showThreadLockPrompt(ctx, thread.title || thread.id, error.ownerPid, thread.id);
          } else {
            ctx.showError(`Failed to switch thread: ${error instanceof Error ? error.message : String(error)}`);
          }
          resolve();
          return;
        }
        state.pendingNewThread = false;

        state.chatContainer.clear();
        state.allToolComponents = [];
        state.allSystemReminderComponents = [];
        state.messageComponentsById.clear();
        state.allShellComponents = [];
        state.pendingTools.clear();
        state.pendingTaskToolIds?.clear();
        await ctx.renderExistingMessages();

        ctx.showInfo(`Switched to: ${thread.title || thread.id}`);
        resolve();
      },
      onClone: async thread => {
        state.ui.hideOverlay();
        if (!(await confirmClone(state, thread.title || thread.id))) {
          resolve();
          return;
        }
        try {
          const customTitle = await askCloneName(state);
          const clonedThread = await state.harness.cloneThread({
            sourceThreadId: thread.id,
            ...(customTitle ? { title: customTitle } : {}),
          });
          state.pendingNewThread = false;
          await resetUIAfterClone(ctx, clonedThread.title || clonedThread.id);
        } catch (error) {
          ctx.showError(`Failed to clone thread: ${error instanceof Error ? error.message : String(error)}`);
        }
        resolve();
      },
      onCancel: () => {
        state.ui.hideOverlay();
        resolve();
      },
    });

    showModalOverlay(state.ui, selector, { widthPercent: 0.8, maxHeight: '60%' });
    selector.focused = true;
  });
}
