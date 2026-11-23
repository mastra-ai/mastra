import { describe, expect, it } from 'vitest';

import { getBackgroundToolMetadata } from './background-tool-result.js';

describe('getBackgroundToolMetadata', () => {
  it.each(['running', 'completed', 'failed'])('reads core-owned %s metadata', status => {
    expect(
      getBackgroundToolMetadata({ mastra: { backgroundTask: { taskId: 'task-1', status }, modelOutput: null } }),
    ).toEqual({ taskId: 'task-1', status });
  });

  it.each([
    undefined,
    'Background task started. Task ID: task-1',
    { content: 'Background task started. Task ID: task-1' },
    { taskId: 'task-1', status: 'running' },
    { mastra: { backgroundTask: { taskId: '', status: 'running' } } },
    { mastra: { backgroundTask: { taskId: 'task-1', status: 'unknown' } } },
  ])('rejects text and malformed metadata (%j)', metadata => {
    expect(getBackgroundToolMetadata(metadata)).toBeUndefined();
  });
});
