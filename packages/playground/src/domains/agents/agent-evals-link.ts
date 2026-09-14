export const AGENT_EVAL_TABS = ['experiments', 'datasets', 'scorers', 'review'] as const;
export type AgentEvalTab = (typeof AGENT_EVAL_TABS)[number];

export function isAgentEvalTab(value: string | null): value is AgentEvalTab {
  return AGENT_EVAL_TABS.includes(value as AgentEvalTab);
}

/** Link to an agent's Evals sub-tab. `attachScorer` asks the page to attach that scorer on arrival. */
export function agentEvalsLink(agentId: string, tab: AgentEvalTab, params: { attachScorer?: string } = {}) {
  const search = new URLSearchParams({ tab });
  if (params.attachScorer) search.set('attachScorer', params.attachScorer);
  return `/agents/${encodeURIComponent(agentId)}/evaluate?${search.toString()}`;
}
