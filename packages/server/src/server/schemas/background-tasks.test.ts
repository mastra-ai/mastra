import { describe, it, expect } from 'vitest';
import { listBackgroundTasksQuerySchema } from './background-tasks';

describe('background task list query schema', () => {
  it('rejects a fractional perPage and a negative page at the request boundary', () => {
    expect(listBackgroundTasksQuerySchema.safeParse({ perPage: '2.5' }).success).toBe(false);
    expect(listBackgroundTasksQuerySchema.safeParse({ page: '-1' }).success).toBe(false);
  });
});
