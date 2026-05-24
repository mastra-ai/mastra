/**
 * Harness v1 — canonical contracts.
 *
 * Compile-time + structural assertions on the type-only canonical
 * Task / Run / TaskIndexEntry shapes. There is no runtime behavior to
 * exercise; these tests pin the field set so accidental renames or
 * widening break the build.
 */

import { describe, expect, it } from 'vitest';

import type {
  HarnessRun,
  HarnessRunFinishReason,
  HarnessTask,
  HarnessTaskOrigin,
  HarnessTaskStatus,
  TaskIndexEntry,
} from './contracts';

describe('Harness v1 canonical contracts', () => {
  it('HarnessTask carries the documented field set', () => {
    const task: HarnessTask = {
      taskId: 'task-1',
      origin: 'user',
      sessionId: 'sess-1',
      resourceId: 'r-1',
      threadId: 't-1',
      createdAt: 0,
      status: 'pending',
    };
    expect(task).toMatchObject({
      taskId: 'task-1',
      origin: 'user',
      sessionId: 'sess-1',
      resourceId: 'r-1',
      threadId: 't-1',
      status: 'pending',
    });
  });

  it('HarnessTaskOrigin covers the six entry surfaces', () => {
    const origins: HarnessTaskOrigin[] = ['user', 'a2a', 'channel', 'cli', 'server', 'system'];
    expect(origins).toHaveLength(6);
  });

  it('HarnessTaskStatus covers pending → terminal', () => {
    const statuses: HarnessTaskStatus[] = ['pending', 'running', 'paused', 'cancelled', 'succeeded', 'failed'];
    expect(statuses).toHaveLength(6);
  });

  it('HarnessRun carries the documented field set', () => {
    const run: HarnessRun = {
      runId: 'run-1',
      taskId: 'task-1',
      agentId: 'agent-1',
      modeId: 'default',
      startedAt: 0,
    };
    expect(run.runId).toBe('run-1');
    expect(run.taskId).toBe('task-1');
  });

  it('HarnessRunFinishReason matches agent_end vocabulary', () => {
    const reasons: HarnessRunFinishReason[] = ['complete', 'suspended', 'error', 'aborted', 'budget_exhausted'];
    expect(reasons).toHaveLength(5);
  });

  it('TaskIndexEntry shape supports cross-surface lookup', () => {
    const entry: TaskIndexEntry = {
      taskId: 'task-1',
      sessionId: 'sess-1',
      runId: 'run-1',
      queuedItemId: 'q-1',
      a2aTaskId: 'a2a-1',
    };
    expect(entry).toMatchObject({ taskId: 'task-1', sessionId: 'sess-1' });
  });

  it('TaskIndexEntry only requires taskId + sessionId', () => {
    const entry: TaskIndexEntry = { taskId: 'task-x', sessionId: 'sess-x' };
    expect(entry.runId).toBeUndefined();
    expect(entry.queuedItemId).toBeUndefined();
    expect(entry.a2aTaskId).toBeUndefined();
  });
});
