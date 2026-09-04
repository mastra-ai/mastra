import type { FactorySupervisorFindingRecord } from '../storage/domains/work-items/base.js';
import { SUPERVISOR_ATTENTION_FORCE_SURFACE_MS } from './health.js';
import { SUPERVISOR_HIGH_PRIORITY_KINDS } from './notify.js';

/**
 * The one place that decides whether an open finding is on the human
 * Attention rail. Supervisor-actionable kinds (the same set the emit path
 * rates high priority) stay hidden while `status` is `open`: the supervisor
 * is expected to work them and escalate what needs a person. Everything else
 * is visible immediately. The backstop makes the hide time-bounded: once a
 * finding has been open past `SUPERVISOR_ATTENTION_FORCE_SURFACE_MS` it
 * surfaces regardless. Resolved rows never reach this predicate; the open-row
 * queries key on `resolved_at` as before. Visibility never mutates the row.
 */
export function isSupervisorFindingVisibleToHumans(
  row: Pick<FactorySupervisorFindingRecord, 'status' | 'openedAt' | 'finding'>,
  now: Date,
  forceSurfaceMs: number = SUPERVISOR_ATTENTION_FORCE_SURFACE_MS,
): boolean {
  if (row.status === 'escalated') return true;
  const kind = typeof row.finding.kind === 'string' ? row.finding.kind : '';
  if (!SUPERVISOR_HIGH_PRIORITY_KINDS.has(kind)) return true;
  return now.getTime() - row.openedAt.getTime() >= forceSurfaceMs;
}
