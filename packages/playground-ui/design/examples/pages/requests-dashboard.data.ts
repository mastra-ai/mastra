import type { RequestsDashboardProps } from './requests-dashboard';

const hour = 3_600_000;
const start = Date.UTC(2026, 10, 5, 0);

export const exampleRequests: Pick<
  RequestsDashboardProps,
  'range' | 'filters' | 'buckets' | 'routes' | 'spend' | 'previous' | 'isLoading'
> = {
  range: 'last-24h',
  filters: [{ id: 'environment', fieldId: 'environment', operatorId: 'is', value: 'production' }],
  isLoading: false,
  spend: 84.12,
  previous: { requests: 41_200, errorRate: 0.019, p95: 910, spend: 71.4 },
  buckets: Array.from({ length: 24 }, (_, index) => {
    const wave = Math.sin((index / 24) * Math.PI * 2 - Math.PI / 2) + 1;
    const ok = Math.round(1_200 + wave * 900 + (index % 5) * 40);
    const failed = index === 14 ? 140 : Math.round(12 + (index % 4) * 6);
    const p50 = Math.round(180 + wave * 60);
    return {
      ts: start + index * hour,
      label: `${String(index).padStart(2, '0')}:00`,
      ok,
      failed,
      p50,
      p95: index === 14 ? 1_480 : Math.round(p50 * 3.4),
      p99: index === 14 ? 2_900 : Math.round(p50 * 6.1),
    };
  }),
  routes: [
    { path: 'POST /api/agents/support/generate', requests: 18_430 },
    { path: 'POST /api/agents/triage/stream', requests: 9_120 },
    { path: 'GET /api/workflows/runs', requests: 6_540 },
    { path: 'POST /api/tools/search/execute', requests: 4_310 },
    { path: 'GET /api/memory/threads', requests: 2_870 },
    { path: 'POST /api/workflows/ingest/start', requests: 1_204 },
    { path: 'GET /api/health', requests: 610 },
  ],
};
