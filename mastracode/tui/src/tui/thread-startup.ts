import { ThreadLockError } from '@mastra/code-sdk/utils/thread-lock';
import { SimpleProgressComponent } from './components/simple-progress.js';
import { askModalQuestion } from './modal-question.js';
import { showModalOverlay } from './overlay.js';
import type { LocalRuntime } from './runtime.js';
import type { TUIState } from './state.js';

export type StartupResumeIssue =
  | { kind: 'missing'; threadId: string }
  | { kind: 'locked'; threadId: string; title: string; ownerPid: number };

/**
 * Selects the thread to open at startup. A requested thread that is missing or
 * locked does not throw; the session is left pending a new thread and the issue
 * is returned so the caller can tell the user once the UI is ready.
 */
export async function resumeThreadOnStartup(
  state: TUIState,
  requestedThreadId?: string,
): Promise<StartupResumeIssue | undefined> {
  const local = state.local;
  if (!local) return resumeFactoryThread(state);
  const { session, controller } = local;

  const currentPath = state.projectInfo.rootPath;
  const allThreads = await session.thread.list(requestedThreadId ? { allResources: true } : undefined);
  const activeThreadId = session.thread.getId();

  if (requestedThreadId) {
    const thread = allThreads.find(candidate => candidate.id === requestedThreadId);
    if (!thread) {
      await startPendingNewThread(state, local);
      return { kind: 'missing', threadId: requestedThreadId };
    }
    const originalResourceId = session.identity.getResourceId();
    if (thread.resourceId !== originalResourceId) {
      await controller.setResourceId(session, { resourceId: thread.resourceId });
    }
    if (requestedThreadId !== activeThreadId) {
      try {
        await session.thread.switch({ threadId: requestedThreadId });
      } catch (error) {
        if (!(error instanceof ThreadLockError)) throw error;
        // The new thread belongs to this project, not the locked thread's resource.
        if (session.identity.getResourceId() !== originalResourceId) {
          await controller.setResourceId(session, { resourceId: originalResourceId });
        }
        await startPendingNewThread(state, local);
        return { kind: 'locked', threadId: thread.id, title: thread.title || thread.id, ownerPid: error.ownerPid };
      }
    }
    state.pendingNewThread = false;
    return;
  }

  const threads = allThreads.filter(thread => thread.metadata?.projectPath === currentPath);

  if (threads.length === 0) {
    if (await cloneDriftedThread(state, local)) return;
    state.pendingNewThread = true;
    return;
  }

  for (const thread of [...threads].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())) {
    if (thread.id === session.thread.getId()) return;
    try {
      await session.thread.switch({ threadId: thread.id });
      return;
    } catch (error) {
      if (error instanceof ThreadLockError) continue;
      throw error;
    }
  }

  state.pendingNewThread = true;
}

/** Factory sessions own their threads, so local project-path tagging and resource IDs don't apply. */
async function resumeFactoryThread(state: TUIState): Promise<undefined> {
  if (state.session.thread.getId()) return;
  const [latest] = (await state.session.thread.list()).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  if (latest) await state.session.thread.switch({ threadId: latest.id });
  else state.pendingNewThread = true;
}

/**
 * Leave the session waiting for a new thread. Session creation may already have
 * bound the latest project thread; unbind it (and release its lock) so the UI
 * and exit hint don't show a thread the user didn't ask for.
 */
async function startPendingNewThread(state: TUIState, { session }: LocalRuntime): Promise<void> {
  session.thread.cleanupSubscription();
  await session.thread.clearAndReleaseLock();
  state.pendingNewThread = true;
}

async function cloneDriftedThread(state: TUIState, { session }: LocalRuntime): Promise<boolean> {
  const currentPath = state.projectInfo.rootPath;
  const currentResourceId = session.identity.getResourceId();
  const driftCandidates = (
    await session.thread.list({
      allResources: true,
      metadata: { projectPath: currentPath },
    })
  ).filter(thread => thread.resourceId !== currentResourceId);
  const thread = [...driftCandidates].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  if (!thread) return false;

  const answer = await askModalQuestion(state.ui, {
    question: [
      'This directory is tagged on a different resource.',
      '',
      `Project: ${currentPath}`,
      `Thread: ${thread.title || thread.id}`,
      `Old resource: ${thread.resourceId}`,
      `Current resource: ${currentResourceId}`,
      '',
      'Clone this thread into the current resource and resume the clone?',
    ].join('\n'),
    options: [{ label: 'Clone and resume' }, { label: 'Start fresh' }],
    selectedOptionLabel: 'Clone and resume',
    allowCustomResponse: false,
    overlay: { widthPercent: 80, maxHeight: '70%' },
  });
  if (answer !== 'Clone and resume') return false;

  const progress = new SimpleProgressComponent({ showElapsed: false, showPercentage: false });
  progress.start('Cloning thread into the current resource...');
  showModalOverlay(state.ui, progress, { widthPercent: 70, maxHeight: '40%', minHeightPercent: 0.35 });
  state.ui.requestRender();

  try {
    await new Promise(resolve => setTimeout(resolve, 50));
    progress.updateStatus('Loading cloned thread...');
    state.ui.requestRender();
    await session.thread.cloneToCurrentResource({
      threadId: thread.id,
      expectedResourceId: thread.resourceId,
      expectedProjectPath: currentPath,
    });
  } finally {
    state.ui.hideOverlay();
    state.ui.requestRender();
  }
  return true;
}
