import { TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage/constants';
import { describe, expect, it, vi } from 'vitest';

import { handleTypedOperation } from './storage';

describe('mastraStorage typed load', () => {
  it('uses by_workflow_run for workflow snapshot composite keys', async () => {
    const workflowRun = {
      workflow_name: 'workflow-a',
      run_id: 'run-1',
      snapshot: {},
    };

    const builder = {
      eq: vi.fn((_field: string, _value: string) => builder),
    };
    const unique = vi.fn(async () => workflowRun);
    const take = vi.fn(async () => {
      throw new Error('load should not scan workflow snapshots for composite keys');
    });
    const withIndex = vi.fn((_indexName: string, queryBuilder: (q: typeof builder) => typeof builder) => {
      queryBuilder(builder);
      return { unique, take };
    });
    const query = vi.fn(() => ({ withIndex, take }));
    const ctx = { db: { query } } as any;

    const result = await handleTypedOperation(ctx, 'mastra_workflow_snapshots', {
      op: 'load',
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      keys: { workflow_name: 'workflow-a', run_id: 'run-1' },
    });

    expect(result).toEqual({ ok: true, result: workflowRun });
    expect(query).toHaveBeenCalledWith('mastra_workflow_snapshots');
    expect(withIndex).toHaveBeenCalledWith('by_workflow_run', expect.any(Function));
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'workflow_name', 'workflow-a');
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'run_id', 'run-1');
    expect(unique).toHaveBeenCalledTimes(1);
    expect(take).not.toHaveBeenCalled();
  });
});
