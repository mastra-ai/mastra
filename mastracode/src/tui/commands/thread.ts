import type { SlashCommandContext } from './types.js';

function formatDateWithLocal(date: Date): string {
  return `${date.toISOString()} [${date.toLocaleString()}]`;
}

export async function handleThreadCommand(ctx: SlashCommandContext): Promise<void> {
  const { harness, state } = ctx;
  const currentThreadId = harness.getCurrentThreadId();
  const currentResourceId = harness.getResourceId();
  const isPendingNewThread = state.pendingNewThread;

  if (!currentThreadId) {
    const lines = ['No active thread.', `Resource: ${currentResourceId}`];

    if (isPendingNewThread) {
      lines.push('Pending new thread: yes');
    }

    ctx.showInfo(lines.join('\n'));
    return;
  }

  const threads = await harness.listThreads({ allResources: true });
  const thread = threads.find(t => t.id === currentThreadId);

  const cloneMetadata =
    thread?.metadata && typeof thread.metadata === 'object'
      ? (thread.metadata as { clone?: { sourceThreadId?: string; clonedAt?: Date | string } }).clone
      : undefined;

  const lines = [
    `Title: ${thread?.title?.trim() || '(untitled)'}`,
    `ID: ${currentThreadId}`,
    `Resource: ${thread?.resourceId ?? currentResourceId}`,
  ];

  if (thread) {
    lines.push(`Created: ${formatDateWithLocal(thread.createdAt)}`);
    lines.push(`Updated: ${formatDateWithLocal(thread.updatedAt)}`);
  }

  if (isPendingNewThread) {
    lines.push('Pending new thread: yes');
  }

  if (cloneMetadata?.sourceThreadId) {
    lines.push(`Forked from: ${cloneMetadata.sourceThreadId}`);
    if (cloneMetadata.clonedAt) {
      const clonedAt =
        cloneMetadata.clonedAt instanceof Date ? cloneMetadata.clonedAt : new Date(cloneMetadata.clonedAt);
      lines.push(`Forked at: ${formatDateWithLocal(clonedAt)}`);
    }
  }

  ctx.showInfo(lines.join('\n'));
}
