import type { MastraClient, Monitor, MonitorEvent } from '@mastra/client-js';

export const relevancyMonitor: Monitor = {
  id: 'monitor-1',
  name: 'Relevancy floor — oncology',
  filter: { scorerIds: ['relevancy-scorer'], metadata: { cohort: 'oncology' } },
  windowMinutes: 60,
  aggregation: 'avg',
  threshold: { op: 'lt', value: 0.7 },
  cooldownMinutes: 30,
  channels: [{ type: 'webhook', url: 'https://hooks.example.com/alerts', format: 'json' }],
  status: 'active',
  breached: true,
  lastEvaluatedAt: Date.UTC(2026, 7, 20, 12, 0, 0),
  createdAt: Date.UTC(2026, 7, 19, 9, 0, 0),
  updatedAt: Date.UTC(2026, 7, 20, 12, 0, 0),
};

export const oneMonitor: Awaited<ReturnType<MastraClient['listMonitors']>> = {
  monitors: [relevancyMonitor],
};

export const noMonitors: Awaited<ReturnType<MastraClient['listMonitors']>> = {
  monitors: [],
};

export const breachEvent: MonitorEvent = {
  id: 'event-1',
  monitorId: relevancyMonitor.id,
  type: 'breach',
  value: 0.52,
  count: 12,
  threshold: relevancyMonitor.threshold,
  windowStart: Date.UTC(2026, 7, 20, 11, 0, 0),
  windowEnd: Date.UTC(2026, 7, 20, 12, 0, 0),
  createdAt: Date.UTC(2026, 7, 20, 12, 0, 0),
};

export const monitorEvents: Awaited<ReturnType<MastraClient['listMonitorEvents']>> = {
  events: [breachEvent],
};

export const emptyScorers: Awaited<ReturnType<MastraClient['listScorers']>> = {};
