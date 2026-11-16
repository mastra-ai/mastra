import { describe, expect, it } from 'vitest';
import type { QueryValues } from '../../client';
import { RecordingDbClientBase } from '../memory/test-utils';
import { WorkflowsPG } from './index';

class WorkflowRunsQueryClient extends RecordingDbClientBase {
  pageRows: Record<string, unknown>[] = [];
  count = 0;

  override async oneOrNone<T = any>(query: string, values?: QueryValues): Promise<T | null> {
    this.queries.push({ query, values });
    return { data_type: 'jsonb' } as T;
  }

  override async one<T = any>(query: string, values?: QueryValues): Promise<T> {
    this.queries.push({ query, values });
    return { count: String(this.count) } as T;
  }

  override async manyOrNone<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    this.queries.push({ query, values });
    return this.pageRows as T[];
  }

  countQueries(): string[] {
    return this.queries.map(recorded => recorded.query).filter(query => query.includes('COUNT('));
  }
}

function createRow(runId: string) {
  const createdAt = '2025-01-01T00:00:00.000Z';
  return {
    workflow_name: 'approval-workflow',
    run_id: runId,
    resourceId: 'resource-1',
    snapshot: JSON.stringify({ runId, status: 'suspended' }),
    header: null,
    createdAt,
    createdAtZ: createdAt,
    updatedAt: createdAt,
    updatedAtZ: createdAt,
    version: 1,
  };
}

describe('WorkflowsPG listWorkflowRuns round-trips', () => {
  it.each([
    { perPage: 100, page: 0, total: 1 },
    { perPage: 2, page: 1, total: 3 },
  ])(
    'derives the total from a partial page without a COUNT (perPage $perPage, page $page)',
    async ({ perPage, page, total }) => {
      const client = new WorkflowRunsQueryClient();
      client.pageRows = [createRow('run-1')];
      client.count = total;
      const workflows = new WorkflowsPG({ client });

      const result = await workflows.listWorkflowRuns({ resourceId: 'resource-1', perPage, page });

      expect(client.countQueries()).toEqual([]);
      expect(result.total).toBe(total);
      expect(result.runs.map(run => run.runId)).toEqual(['run-1']);
    },
  );

  it('counts when the page comes back full', async () => {
    const client = new WorkflowRunsQueryClient();
    client.pageRows = [createRow('run-1'), createRow('run-2')];
    client.count = 5;
    const workflows = new WorkflowsPG({ client });

    const result = await workflows.listWorkflowRuns({ perPage: 2, page: 0 });

    expect(client.countQueries()).toHaveLength(1);
    expect(result.total).toBe(5);
    expect(result.runs).toHaveLength(2);
  });

  it('counts when a page past the last run comes back empty', async () => {
    const client = new WorkflowRunsQueryClient();
    client.count = 4;
    const workflows = new WorkflowsPG({ client });

    const result = await workflows.listWorkflowRuns({ perPage: 10, page: 3 });

    expect(client.countQueries()).toHaveLength(1);
    expect(result.total).toBe(4);
    expect(result.runs).toEqual([]);
  });
});
