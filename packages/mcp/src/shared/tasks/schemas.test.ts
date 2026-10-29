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
  it('accepts ISO 8601 timestamps', () => {
    expect(TaskSchema.safeParse(task).success).toBe(true);
    expect(DetailedTaskSchema.safeParse({ ...task, createdAt: '2026-10-29T08:00:00-04:00' }).success).toBe(true);
  });

  it('rejects a createdAt that is not a timestamp, since the TTL is counted from it', () => {
    expect(TaskSchema.safeParse({ ...task, createdAt: 'invalid' }).success).toBe(false);
    expect(DetailedTaskSchema.safeParse({ ...task, createdAt: 'invalid' }).success).toBe(false);
  });
});
