import type { SlashCommandContext } from './types.js';

export async function handleThreadCommand(ctx: SlashCommandContext): Promise<void> {
  const { harness, state } = ctx;
  const currentThreadId = harness.getCurrentThreadId();
  const currentResourceId = harness.getResourceId();
  const defaultResourceId = harness.getDefaultResourceId();
  const isPendingNewThread = state.pendingNewThread;

  if (!currentThreadId) {
    const lines = [
      'No active thread.',
      `Pending new thread: ${isPendingNewThread ? 'yes' : 'no'}`,
      `Current resource: ${currentResourceId}`,
      `Default resource: ${defaultResourceId}`,
    ];

    ctx.showInfo(lines.join('\n'));
    return;
  }

  const threads = await harness.listThreads({ allResources: true });
  const thread = threads.find(t => t.id === currentThreadId);

  const lines = [
    `Current thread: ${currentThreadId}`,
    `Title: ${thread?.title?.trim() || '(untitled)'}`,
    `Resource: ${thread?.resourceId ?? currentResourceId}`,
    `Default resource: ${defaultResourceId}`,
    `Pending new thread: ${isPendingNewThread ? 'yes' : 'no'}`,
  ];

  if (thread) {
    lines.push(`Created: ${thread.createdAt.toISOString()}`);
    lines.push(`Updated: ${thread.updatedAt.toISOString()}`);
  }

  ctx.showInfo(lines.join('\n'));
}
