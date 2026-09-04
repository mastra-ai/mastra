import { z } from 'zod';
import type { LangfuseObservation } from './providers/langfuse/schema.js';
import type { AssembledTrace, SkippedTrace, TraceAssemblyResult, TraceSkipReason } from './types.js';

const sourceTimestampSchema = z.string().datetime({ offset: true });

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value || !sourceTimestampSchema.safeParse(value).success) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveVirtualRootEndTime(
  sourceTraceId: string,
  observations: LangfuseObservation[],
  root: LangfuseObservation,
): LangfuseObservation[] {
  if (root.endTime || root.id !== `t-${sourceTraceId}`) return observations;

  const childEnds = observations
    .filter(observation => observation.id !== root.id)
    .map(observation => ({
      observation,
      end: parseTimestamp(observation.endTime ?? (observation.type === 'EVENT' ? observation.startTime : undefined)),
    }))
    .filter((item): item is { observation: LangfuseObservation; end: number } => item.end !== null)
    .sort((left, right) => right.end - left.end || left.observation.id.localeCompare(right.observation.id));

  const latest = childEnds[0];
  if (!latest) return observations;

  return observations.map(observation =>
    observation.id === root.id
      ? {
          ...observation,
          endTime: new Date(latest.end).toISOString(),
          mastraImportDerivedEndTime: true,
          mastraImportDerivedEndTimeSourceObservationId: latest.observation.id,
        }
      : observation,
  );
}

export function createSkippedTrace(
  sourceTraceId: string | null,
  observations: LangfuseObservation[],
  reason: TraceSkipReason,
  detail?: string,
): SkippedTrace {
  const startedAt = observations
    .map(observation => observation.startTime)
    .filter((value): value is string => typeof value === 'string')
    .sort();
  const endedAt = observations
    .map(observation => observation.endTime ?? observation.startTime)
    .filter((value): value is string => typeof value === 'string')
    .sort();
  const traceName = observations.find(observation => observation.traceName)?.traceName ?? undefined;

  return {
    sourceTraceId,
    observationCount: observations.length,
    reason,
    detail,
    observationIds: observations.map(observation => observation.id).sort(),
    observationTypes: [...new Set(observations.map(observation => observation.type))].sort(),
    traceName,
    firstStartedAt: startedAt[0],
    lastEndedAt: endedAt.at(-1),
  };
}

function validateAndOrderTrace(
  sourceTraceId: string,
  observations: LangfuseObservation[],
  cutoffMs: number,
  snapshotMs: number,
): { trace?: AssembledTrace; skipped?: SkippedTrace } {
  const projectIds = new Set(observations.map(observation => observation.projectId));
  if (projectIds.size !== 1) {
    return { skipped: createSkippedTrace(sourceTraceId, observations, 'mixed_project_ids') };
  }

  const byId = new Map<string, LangfuseObservation>();
  for (const observation of observations) {
    if (byId.has(observation.id)) {
      return {
        skipped: createSkippedTrace(sourceTraceId, observations, 'duplicate_observation_id', observation.id),
      };
    }
    byId.set(observation.id, observation);
  }

  const roots = observations.filter(
    observation =>
      !observation.parentObservationId ||
      (observation.isRootObservation === true && !byId.has(observation.parentObservationId)),
  );
  if (roots.length === 0) return { skipped: createSkippedTrace(sourceTraceId, observations, 'missing_root') };
  if (roots.length > 1) return { skipped: createSkippedTrace(sourceTraceId, observations, 'multiple_roots') };
  const rootCandidate = roots[0]!;
  const normalizedObservations = deriveVirtualRootEndTime(sourceTraceId, observations, rootCandidate);
  const normalizedById = new Map(normalizedObservations.map(observation => [observation.id, observation]));
  const root = normalizedById.get(rootCandidate.id)!;

  for (const observation of normalizedObservations) {
    if (
      observation !== root &&
      observation.parentObservationId &&
      !normalizedById.has(observation.parentObservationId)
    ) {
      return {
        skipped: createSkippedTrace(
          sourceTraceId,
          normalizedObservations,
          'missing_parent',
          observation.parentObservationId,
        ),
      };
    }

    const start = parseTimestamp(observation.startTime);
    if (start === null) {
      return {
        skipped: createSkippedTrace(sourceTraceId, normalizedObservations, 'invalid_timestamp', observation.id),
      };
    }

    if (observation.type === 'EVENT') {
      if (observation.endTime && parseTimestamp(observation.endTime) === null) {
        return {
          skipped: createSkippedTrace(sourceTraceId, normalizedObservations, 'invalid_timestamp', observation.id),
        };
      }
      continue;
    }

    if (!observation.endTime) {
      return {
        skipped: createSkippedTrace(sourceTraceId, normalizedObservations, 'incomplete_duration', observation.id),
      };
    }
    const end = parseTimestamp(observation.endTime);
    if (end === null) {
      return {
        skipped: createSkippedTrace(sourceTraceId, normalizedObservations, 'invalid_timestamp', observation.id),
      };
    }
    if (end < start) {
      return {
        skipped: createSkippedTrace(sourceTraceId, normalizedObservations, 'invalid_timestamp', observation.id),
      };
    }
    if (end > snapshotMs) {
      return {
        skipped: createSkippedTrace(sourceTraceId, normalizedObservations, 'completed_after_snapshot', observation.id),
      };
    }
  }

  const rootStart = parseTimestamp(root.startTime)!;
  if (rootStart < cutoffMs || rootStart >= snapshotMs) {
    return { skipped: createSkippedTrace(sourceTraceId, normalizedObservations, 'root_outside_window') };
  }

  const children = new Map<string, LangfuseObservation[]>();
  for (const observation of normalizedObservations) {
    if (observation === root || !observation.parentObservationId) continue;
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

  if (!visit(root) || visited.size !== normalizedObservations.length) {
    return { skipped: createSkippedTrace(sourceTraceId, normalizedObservations, 'cycle') };
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
      skipped.push(createSkippedTrace(null, [observation], 'missing_trace_id', observation.id));
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
