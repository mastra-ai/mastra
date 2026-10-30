import { describe, expect, it } from 'vitest';
import { DetailedTaskSchema, TaskSchema } from './schemas';

const task = {
  taskId: 't',
  status: 'working',
  createdAt: '2026-10-29T12:00:00.000Z',
  lastUpdatedAt: '2026-10-29T12:00:00.000Z',
  ttlMs: 60_000,
};

describe('task schemas', () => {
  it('accepts ISO 8601 timestamps in any format, including ones Date.parse rejects', () => {
    expect(TaskSchema.safeParse(task).success).toBe(true);
    expect(DetailedTaskSchema.safeParse({ ...task, createdAt: '2026-10-29T08:00:00-04:00' }).success).toBe(true);
    // Basic format: valid ISO 8601, but Date.parse returns NaN. The waiter falls back to its own clock.
    expect(TaskSchema.safeParse({ ...task, createdAt: '20261029T120000Z' }).success).toBe(true);
  });
});
