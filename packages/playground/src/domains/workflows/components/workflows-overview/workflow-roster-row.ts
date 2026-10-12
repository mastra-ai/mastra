import type { GetWorkflowResponse } from '@mastra/client-js';
import type { ListSort, SortAccessors } from '@mastra/playground-ui/sort/sort-by';
import type { Regression } from '@/domains/overview/components/attention-strip';
import { errorRateRegression, latencyRegression } from '@/domains/overview/regressions';
import { errorRateOf } from '@/domains/overview/run-activity';
import type { RunActivity } from '@/domains/overview/run-activity';
import type { Latency } from '@/domains/overview/use-root-run-latency';

export interface WorkflowRosterRow {
  id: string;
  name: string;
  workflow: GetWorkflowResponse;
  activity?: RunActivity;
  latency?: Latency;
  running: number;
  suspended: number;
}

export const workflowSortKeys = ['name', 'runs', 'failureRate', 'p95', 'suspended', 'lastRun'] as const;
export type WorkflowSortKey = (typeof workflowSortKeys)[number];
export const defaultWorkflowSort: ListSort<WorkflowSortKey> = { key: 'runs', direction: 'desc' };

export const workflowSortAccessors: SortAccessors<WorkflowRosterRow, WorkflowSortKey> = {
  name: row => row.name,
  runs: row => row.activity?.runs,
  failureRate: row => (row.activity ? errorRateOf(row.activity.runs, row.activity.errors) : null),
  p95: row => row.latency?.p95,
  suspended: row => row.suspended,
  lastRun: row => row.activity?.lastRunBucketMs,
};

export function workflowComposition(workflow: GetWorkflowResponse) {
  const stepCount = Object.keys(workflow.steps ?? {}).length;
  return `${stepCount} ${stepCount === 1 ? 'step' : 'steps'}`;
}

export function isWorkflowActive(row: WorkflowRosterRow) {
  return (row.activity?.runs ?? 0) > 0 || row.running > 0 || row.suspended > 0;
}

export function workflowRegressions(
  rows: WorkflowRosterRow[],
  workflowHref: (workflowId: string) => string,
): Regression[] {
  return rows.flatMap(row => {
    const reasons = [
      row.activity && errorRateRegression(row.activity, 'failure rate'),
      latencyRegression(row.latency),
    ].filter(reason => typeof reason === 'string');
    return reasons.length > 0 ? [{ key: row.id, name: row.name, href: workflowHref(row.id), reasons }] : [];
  });
}
