import { describe, expect, it, vi } from 'vitest';
import type { WorkflowRuns } from '../../types';
import { WorkflowsStorage } from './base';

class StubWorkflowsStorage extends WorkflowsStorage {
  supportsConcurrentUpdates() {
    return false;
  }
  updateWorkflowResults = vi.fn() as any;
  updateWorkflowState = vi.fn() as any;
  persistWorkflowSnapshot = vi.fn() as any;
  loadWorkflowSnapshot = vi.fn() as any;
  getWorkflowRunById = vi.fn() as any;
  deleteWorkflowRunById = vi.fn() as any;
  listWorkflowRuns = vi.fn<() => Promise<WorkflowRuns>>();
}

describe('workflow run summary fallback', () => {
  it('drops snapshot outputs and preserves metadata', async () => {
    const store = new StubWorkflowsStorage();
    const createdAt = new Date('2026-01-01T00:00:00Z');
    store.listWorkflowRuns.mockResolvedValue({
      runs: [
        {
          workflowName: 'wf',
          runId: 'run',
          resourceId: 'tenant',
          createdAt,
          updatedAt: createdAt,
          snapshot: JSON.stringify({ status: 'success', timestamp: 123, value: { large: 'x'.repeat(1000) } }),
        },
      ],
      total: 1,
    });
    const result = await store.listWorkflowRunSummaries({ workflowName: 'wf', page: 0, perPage: 1 });
    expect(store.listWorkflowRuns).toHaveBeenCalledWith({ workflowName: 'wf', page: 0, perPage: 1 });
    expect(result).toEqual({
      total: 1,
      runs: [
        {
          workflowName: 'wf',
          runId: 'run',
          resourceId: 'tenant',
          createdAt,
          updatedAt: createdAt,
          status: 'success',
          timestamp: 123,
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('large');
  });
});

describe('workflow run summary fallback with legacy snapshots', () => {
  it('keeps good rows when another snapshot is malformed or lacks metadata', async () => {
    const store = new StubWorkflowsStorage();
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const run = (runId: string, snapshot: unknown) => ({
      workflowName: 'wf',
      runId,
      snapshot,
      createdAt,
      updatedAt: createdAt,
    });
    store.listWorkflowRuns.mockResolvedValue({
      runs: [
        run('good', JSON.stringify({ status: 'success', timestamp: 123, value: { large: 'x'.repeat(1000) } })),
        run('malformed', '{broken'),
        run('missing', {}),
        run('null', null),
      ] as WorkflowRuns['runs'],
      total: 4,
    });

    const result = await store.listWorkflowRunSummaries();
    expect(result.total).toBe(4);
    expect(result.runs).toHaveLength(4);
    expect(result.runs[0]).toMatchObject({ runId: 'good', status: 'success', timestamp: 123 });
    for (const summary of result.runs.slice(1)) {
      expect(summary.status).toBeUndefined();
      expect(summary.timestamp).toBeUndefined();
      expect(summary.createdAt).toEqual(createdAt);
      expect(summary).not.toHaveProperty('snapshot');
    }
    expect(JSON.stringify(result)).not.toContain('large');
  });
});
