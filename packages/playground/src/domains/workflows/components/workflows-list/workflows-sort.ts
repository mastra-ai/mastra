import type { GetWorkflowResponse } from '@mastra/client-js';
import { sortBy } from '@mastra/playground-ui/sort/sort-by';
import type { ListSort } from '@mastra/playground-ui/sort/sort-by';

export type WorkflowsSortKey = 'name' | 'running' | 'suspended' | 'steps';
export type WorkflowsSort = ListSort<WorkflowsSortKey>;

type RunCounts = Record<string, { running?: number; suspended?: number } | undefined>;

export function sortWorkflows<T extends GetWorkflowResponse & { id: string }>(
  workflows: T[],
  sort: WorkflowsSort,
  runCounts: RunCounts,
): T[] {
  return sortBy(workflows, sort, {
    name: wf => wf.name,
    running: wf => runCounts[wf.id]?.running ?? 0,
    suspended: wf => runCounts[wf.id]?.suspended ?? 0,
    steps: wf => Object.keys(wf.steps ?? {}).length,
  });
}
