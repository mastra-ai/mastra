import type { BackgroundCompletionEvent } from '@mastra/code-sdk/agents/background-completion-events';

export interface BackgroundNoticeTarget {
  resourceId: string;
  threadId?: string | null;
}

export function upsertGlobalBackgroundNotice(
  notices: Map<string, BackgroundCompletionEvent>,
  event: BackgroundCompletionEvent,
  current: BackgroundNoticeTarget,
): void {
  if (event.resourceId === current.resourceId && event.threadId === current.threadId) {
    notices.delete(event.id);
    return;
  }
  notices.set(event.id, event);
}

export function dismissGlobalBackgroundNoticesForTarget(
  notices: Map<string, BackgroundCompletionEvent>,
  target: BackgroundNoticeTarget,
): void {
  for (const [id, notice] of notices) {
    if (notice.resourceId === target.resourceId && notice.threadId === target.threadId) {
      notices.delete(id);
    }
  }
}

export async function navigateToBackgroundCompletion(
  event: Pick<BackgroundCompletionEvent, 'resourceId' | 'threadId'>,
  currentResourceId: string,
  setResourceId: (resourceId: string) => Promise<void>,
  switchThread: (threadId: string) => Promise<void>,
): Promise<void> {
  if (currentResourceId !== event.resourceId) {
    await setResourceId(event.resourceId);
  }
  await switchThread(event.threadId);
}
