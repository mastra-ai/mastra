import type { HarnessThread } from '@mastra/core/harness';

export function toLegacyThread(thread: {
  id: string;
  resourceId: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}): HarnessThread {
  return {
    id: thread.id,
    resourceId: thread.resourceId,
    title: thread.title ?? '',
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    metadata: thread.metadata,
  };
}
