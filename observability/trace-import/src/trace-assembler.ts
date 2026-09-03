import { z } from 'zod';
import type { LangfuseObservation } from './providers/langfuse/schema.js';
import type { AssembledTrace, TraceAssemblyResult, TraceSkipReason } from './types.js';

const sourceTimestampSchema = z.string().datetime({ offset: true });

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value || !sourceTimestampSchema.safeParse(value).success) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function skip(
  sourceTraceId: string | null,
  observations: LangfuseObservation[],
  reason: TraceSkipReason,
  detail?: string,
) {
  return { sourceTraceId, observationCount: observations.length, reason, detail };
}

function validateAndOrderTrace(
  sourceTraceId: string,
  observations: LangfuseObservation[],
  cutoffMs: number,
  snapshotMs: number,
): { trace?: AssembledTrace; skipped?: ReturnType<typeof skip> } {
  const projectIds = new Set(observations.map(observation => observation.projectId));
  if (projectIds.size !== 1) {
    return { skipped: skip(sourceTraceId, observations, 'mixed_project_ids') };
  }

  const byId = new Map<string, LangfuseObservation>();
  for (const observation of observations) {
    if (byId.has(observation.id)) {
      return {
        skipped: skip(sourceTraceId, observations, 'duplicate_observation_id', observation.id),
      };
    }
    byId.set(observation.id, observation);
  }

  const roots = observations.filter(observation => !observation.parentObservationId);
  if (roots.length === 0) return { skipped: skip(sourceTraceId, observations, 'missing_root') };
  if (roots.length > 1) return { skipped: skip(sourceTraceId, observations, 'multiple_roots') };

  for (const observation of observations) {
    if (observation.parentObservationId && !byId.has(observation.parentObservationId)) {
      return {
        skipped: skip(sourceTraceId, observations, 'missing_parent', observation.parentObservationId),
      };
    }

    const start = parseTimestamp(observation.startTime);
    if (start === null) {
      return { skipped: skip(sourceTraceId, observations, 'invalid_timestamp', observation.id) };
    }

    if (observation.type === 'EVENT') {
      if (observation.endTime && parseTimestamp(observation.endTime) === null) {
        return { skipped: skip(sourceTraceId, observations, 'invalid_timestamp', observation.id) };
      }
      continue;
    }

    if (!observation.endTime) {
      return { skipped: skip(sourceTraceId, observations, 'incomplete_duration', observation.id) };
    }
    const end = parseTimestamp(observation.endTime);
    if (end === null) {
      return { skipped: skip(sourceTraceId, observations, 'invalid_timestamp', observation.id) };
    }
    if (end < start) {
      return { skipped: skip(sourceTraceId, observations, 'invalid_timestamp', observation.id) };
    }
  }

  const root = roots[0]!;
  const rootStart = parseTimestamp(root.startTime)!;
  if (rootStart < cutoffMs || rootStart >= snapshotMs) {
    return { skipped: skip(sourceTraceId, observations, 'root_outside_window') };
  }

  const children = new Map<string, LangfuseObservation[]>();
  for (const observation of observations) {
    if (!observation.parentObservationId) continue;
    const siblings = children.get(observation.parentObservationId) ?? [];
    siblings.push(observation);
    children.set(observation.parentObservationId, siblings);
  }
  for (const siblings of children.values()) {
    siblings.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id));
  }

  const ordered: LangfuseObservation[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (observation: LangfuseObservation): boolean => {
    if (visiting.has(observation.id)) return false;
    if (visited.has(observation.id)) return true;
    visiting.add(observation.id);
    ordered.push(observation);
    for (const child of children.get(observation.id) ?? []) {
      if (!visit(child)) return false;
    }
    visiting.delete(observation.id);
    visited.add(observation.id);
    return true;
  };

  if (!visit(root) || visited.size !== observations.length) {
    return { skipped: skip(sourceTraceId, observations, 'cycle') };
  }

  return {
    trace: {
      sourceTraceId,
      projectId: projectIds.values().next().value!,
      observations: ordered,
    },
  };
}

export function assembleTraces(
  observations: LangfuseObservation[],
  window: { cutoffAt: string; snapshotAt: string },
): TraceAssemblyResult {
  const cutoffMs = Date.parse(window.cutoffAt);
  const snapshotMs = Date.parse(window.snapshotAt);
  if (!Number.isFinite(cutoffMs) || !Number.isFinite(snapshotMs) || cutoffMs >= snapshotMs) {
    throw new Error('The import window is invalid.');
  }

  const grouped = new Map<string, LangfuseObservation[]>();
  const skipped: TraceAssemblyResult['skipped'] = [];
  for (const observation of observations) {
    const traceId = observation.traceId?.trim();
    if (!traceId) {
      skipped.push(skip(null, [observation], 'missing_trace_id', observation.id));
      continue;
    }
    const trace = grouped.get(traceId) ?? [];
    trace.push(observation);
    grouped.set(traceId, trace);
  }

  const traces: AssembledTrace[] = [];
  for (const sourceTraceId of [...grouped.keys()].sort()) {
    const result = validateAndOrderTrace(sourceTraceId, grouped.get(sourceTraceId)!, cutoffMs, snapshotMs);
    if (result.trace) traces.push(result.trace);
    if (result.skipped) skipped.push(result.skipped);
  }

  return { traces, skipped };
}
