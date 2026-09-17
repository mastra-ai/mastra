import { z } from 'zod';
import type { Observation } from './store.js';

export const ReviewedEscalationSchema = z.object({
  tenantId: z.string().min(1),
  incidentId: z.string().min(1),
  actualEscalated: z.boolean(),
  expectedEscalated: z.boolean(),
  reviewedBy: z.string().min(1),
  reviewedAt: z.iso.datetime(),
});
export type ReviewedEscalation = z.infer<typeof ReviewedEscalationSchema>;
const metric = (values: number[]) =>
  values.length
    ? {
        status: 'OBSERVED',
        samples: values.length,
        value: values.reduce((a, b) => a + b, 0) / values.length,
      }
    : { status: 'NO_DATA', samples: 0, value: null };
const duration = (start: string | null, end: string | null) => {
  if (!start || !end) return [];
  const milliseconds = Date.parse(end) - Date.parse(start);
  return Number.isFinite(milliseconds) && milliseconds >= 0 ? [milliseconds] : [];
};

export function analyticsReport(
  tenant: string,
  observations: readonly Observation[],
  labels: readonly ReviewedEscalation[] = [],
) {
  if (!tenant.trim() || observations.some(row => row.tenant_id !== tenant))
    throw new Error('ANALYTICS_TENANT_MISMATCH');
  const latest = new Map<string, Observation>();
  const groups = new Map<string, Observation[]>();
  for (const row of observations) {
    const key = `${row.kind}:${row.entity_id}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
    if (!latest.has(key) || latest.get(key)!.sequence < row.sequence) latest.set(key, row);
  }
  const workflows = [...groups.values()].filter(rows => rows[0]!.kind === 'workflow');
  const triageLatency = workflows.flatMap(rows => {
    const start = rows[0]?.triaged === 0 ? rows[0] : undefined;
    const finish = rows.find(row => row.triaged === 1 && row.observed_at !== null);
    return duration(start?.observed_at ?? null, finish?.observed_at ?? null);
  });
  const approvals = [...latest.values()].filter(row => row.kind === 'approval');
  const sources = [...latest.values()].filter(row => row.kind === 'evidence-source');
  const uniqueLabels = new Set<string>();
  const reviewed = labels
    .map(label => ReviewedEscalationSchema.parse(label))
    .map(label => {
      if (
        label.tenantId !== tenant ||
        uniqueLabels.has(label.incidentId) ||
        !observations.some(row => row.incident_id === label.incidentId)
      )
        throw new Error('INVALID_REVIEWED_LABEL_SCOPE');
      uniqueLabels.add(label.incidentId);
      return Number(label.actualEscalated === label.expectedEscalated);
    });
  return {
    version: 1,
    tenantId: tenant,
    observations: observations.length,
    triageLatencyMs: metric(triageLatency),
    approvalLatencyMs: metric(approvals.flatMap(row => duration(row.started_at, row.finished_at))),
    approvalOutcomes: Object.fromEntries(
      ['pending', 'approved', 'rejected', 'expired'].map(status => [
        status,
        approvals.filter(row => row.status === status).length,
      ]),
    ),
    investigationSourceGaps: sources.filter(row => row.status !== 'present').length,
    investigationSourceFailureRate: metric(sources.map(row => Number(row.status === 'failed'))),
    workflowCarrierCoverage: metric(
      [...latest.values()].filter(row => row.kind === 'workflow').map(row => row.trace_present),
    ),
    providerFailureRate: metric(
      [...latest.values()]
        .filter(row => row.kind === 'provider' && ['succeeded', 'retry', 'exhausted', 'uncertain'].includes(row.status))
        .map(row => Number(row.status !== 'succeeded')),
    ),
    containmentFailureRate: metric(
      [...latest.values()]
        .filter(row => row.kind === 'containment' && ['completed', 'failed', 'timed_out'].includes(row.status))
        .map(row => Number(['failed', 'timed_out'].includes(row.status))),
    ),
    containmentBlocked: [...latest.values()].filter(row => row.kind === 'containment' && row.status === 'blocked')
      .length,
    escalationAccuracy: metric(reviewed),
    traceCompleteness: {
      ...metric([]),
      scope:
        'Full span completeness is unavailable in this read model. Actual traces remain in Mastra observability; workflow carrier presence is reported separately.',
    },
  };
}
