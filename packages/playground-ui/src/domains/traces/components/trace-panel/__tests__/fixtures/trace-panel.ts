import type { GetScorerResponse } from '@mastra/client-js';

import { panelTraceSpans, skillSignalRootDetail } from '../../../__tests__/fixtures/trace-span-panel';

/** The scorers a host lists (`listScorers`): one registered for any span, one only for top-level agent runs. */
export const panelScorers: Record<string, GetScorerResponse> = {
  helpfulness: {
    scorer: { config: { id: 'helpfulness', name: 'Helpfulness', description: 'Rates how helpful the answer is.' } },
    agentIds: [],
    agentNames: [],
    workflowIds: [],
    isRegistered: true,
    source: 'code',
  },
};

/** The full trace (`getTrace`) whose root run a skill signal started. */
export const skillSignalTraceSpans = panelTraceSpans.spans.map(span =>
  span.spanId === skillSignalRootDetail.span.spanId ? skillSignalRootDetail.span : span,
);
