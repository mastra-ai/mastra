import type { GetAgentResponse } from '@mastra/client-js';
import type { ListSort, SortAccessors } from '@mastra/playground-ui/sort/sort-by';
import type { AgentEvalScores } from '../../hooks/use-agents-eval-scores';
import type { Regression } from '@/domains/overview/components/attention-strip';
import { errorRateRegression, latencyRegression } from '@/domains/overview/regressions';
import { errorRateOf } from '@/domains/overview/run-activity';
import type { RunActivity } from '@/domains/overview/run-activity';
import type { Latency } from '@/domains/overview/use-root-run-latency';

export interface AgentRosterRow {
  id: string;
  name: string;
  agent: GetAgentResponse;
  activity?: RunActivity;
  cost: number | null;
  latency?: Latency;
  scores?: AgentEvalScores;
}

export const agentSortKeys = ['name', 'runs', 'errorRate', 'p95', 'cost', 'score', 'lastRun'] as const;
export type AgentSortKey = (typeof agentSortKeys)[number];
export const defaultAgentSort: ListSort<AgentSortKey> = { key: 'runs', direction: 'desc' };

export const agentSortAccessors: SortAccessors<AgentRosterRow, AgentSortKey> = {
  name: row => row.name,
  runs: row => row.activity?.runs,
  errorRate: row => (row.activity ? errorRateOf(row.activity.runs, row.activity.errors) : null),
  p95: row => row.latency?.p95,
  cost: row => row.cost,
  score: row => row.scores?.average,
  lastRun: row => row.activity?.lastRunBucketMs,
};

const SCORE_DROP = 0.1;

function countOf(count: number, noun: string) {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

export function agentComposition(agent: GetAgentResponse) {
  const toolCount = Object.keys(agent.tools ?? {}).length;
  const workflowCount = Object.keys(agent.workflows ?? {}).length;
  return [agent.modelId, countOf(toolCount, 'tool'), countOf(workflowCount, 'workflow')].filter(Boolean).join(' · ');
}

export function isAgentActive(row: AgentRosterRow) {
  return (row.activity?.runs ?? 0) > 0;
}

function scoreDrops(scores: AgentEvalScores | undefined) {
  return (scores?.byScorer ?? []).flatMap(scorer =>
    scorer.previousAverage !== null && scorer.previousAverage - scorer.average >= SCORE_DROP
      ? [`${scorer.scorerName} ${scorer.average.toFixed(2)}, was ${scorer.previousAverage.toFixed(2)}`]
      : [],
  );
}

export function agentRegressions(rows: AgentRosterRow[], agentHref: (agentId: string) => string): Regression[] {
  return rows.flatMap(row => {
    const reasons = [
      row.activity && errorRateRegression(row.activity, 'error rate'),
      latencyRegression(row.latency),
      ...scoreDrops(row.scores),
    ].filter(reason => typeof reason === 'string');
    return reasons.length > 0 ? [{ key: row.id, name: row.name, href: agentHref(row.id), reasons }] : [];
  });
}
