import type { FactoryMetrics } from '../domains/factory/services/metrics';

const NO_FLOW: FactoryMetrics['intake'] = { arrived: 0, pickedUp: 0, waiting: 0 };
const NO_LEAD_TIME: FactoryMetrics['leadTime'] = { medianMs: null, p90Ms: null, samples: 0 };

/** A board that has recorded nothing: every spec spreads this and sets the fields it is about. */
export const EMPTY_METRICS: FactoryMetrics = {
  daysCovered: 30,
  throughput: [],
  leadTime: NO_LEAD_TIME,
  sourceMix: [],
  intake: NO_FLOW,
  review: { intake: NO_FLOW, throughput: [], completed: 0, leadTime: NO_LEAD_TIME },
  funnel: { gates: [], edges: [], rework: { cards: 0, medianExtraMs: null, percent: null } },
  stageDwell: [],
  previous: null,
  agentCoverage: [],
  agentCoveragePercent: null,
  series: { leadTimeHours: [], agentCoveragePercent: [], reworkPercent: [] },
};
