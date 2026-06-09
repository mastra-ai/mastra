import { afterEach, describe, expect, it } from 'vitest';

import { createRealV1Harness } from '../test-utils/real-v1-harness.js';

const cleanups: Array<() => void> = [];

const taskWriteToolCall = {
  finishReason: 'tool-calls' as const,
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  content: [
    {
      type: 'tool-call' as const,
      toolCallId: 'call-1',
      toolName: 'task_write',
      input: JSON.stringify({
        tasks: [
          { id: 't1', content: 'Plan', status: 'completed', activeForm: 'Planning' },
          { id: 't2', content: 'Verify', status: 'in_progress', activeForm: 'Verifying' },
        ],
      }),
    },
  ],
  warnings: [],
};

describe('v1 task_write via session.signal', () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  });

  it('persists tasks to session state when run through session.signal()', async () => {
    const { harness, cleanup } = createRealV1Harness<{ tasks?: unknown[] }>({
      doGenerate: async () => taskWriteToolCall,
    });
    cleanups.push(cleanup);
    await harness.init();

    const session = await harness.session({ threadId: 'thread-1', resourceId: 'res-1' });
    await session.signal({ messages: [{ role: 'user', content: 'Create tasks' }] });

    const tasks = (session.getState() as { tasks?: Array<{ content: string; status: string }> }).tasks ?? [];
    expect(tasks).toHaveLength(2);
    expect(tasks.map(t => t.content)).toEqual(['Plan', 'Verify']);
    expect(tasks.find(t => t.content === 'Verify')?.status).toBe('in_progress');
  });
});
