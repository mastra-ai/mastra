import { ThreadLockError } from '@mastra/code-sdk/utils/thread-lock';
import { SimpleProgressComponent } from './components/simple-progress.js';
import { askModalQuestion } from './modal-question.js';
import { showModalOverlay } from './overlay.js';
import type { TUIState } from './state.js';

export async function resumeThreadOnStartup(state: TUIState): Promise<void> {
  const currentPath = state.projectInfo.rootPath;
  const currentResourceId = state.session.identity.getResourceId();
  const allThreads = await state.session.thread.list();
  const activeThreadId = state.session.thread.getId();

  const threads: typeof allThreads = [];
  for (const thread of allThreads) {
    if (thread.metadata?.projectPath !== currentPath) continue;

    if (thread.id === activeThreadId && !thread.title) {
      const messages = await state.session.thread.listMessages({ threadId: thread.id, limit: 1 });
      if (messages.length === 0) {
        await state.session.thread.delete({ threadId: thread.id });
        continue;
      }
    }
    threads.push(thread);
  }

  if (threads.length === 0) {
    if (await cloneDriftedThread(state)) return;
    state.pendingNewThread = true;
    return;
  }

  for (const thread of [...threads].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())) {
    try {
      await state.session.thread.switch({ threadId: thread.id });
      return;
    } catch (error) {
      if (error instanceof ThreadLockError) continue;
      throw error;
    }
  }

  state.pendingNewThread = true;
}

async function cloneDriftedThread(state: TUIState): Promise<boolean> {
  const currentPath = state.projectInfo.rootPath;
  const currentResourceId = state.session.identity.getResourceId();
  const driftCandidates = (
    await state.session.thread.list({
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
    await state.session.thread.cloneToCurrentResource({
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
