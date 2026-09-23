import type { ObservationalMemoryRecord } from '@mastra/core/storage';

import { BOUNDARY_WITH_DATE_RE } from '../../src/processors/observational-memory/observation-utils';

/**
 * One replayable observation cycle recovered from a persisted OM record.
 *
 * `source` records how the cycle was recovered:
 * - `generation-head` — the leading chunk of generation 0 (a genuine first cycle)
 * - `reflection-head` — the leading chunk of a generation > 0, which is the
 *   reflection text rather than observation output, and is never replayed
 * - `boundary`        — a chunk that followed a message-boundary delimiter
 * - `buffered-chunk`  — an unactivated chunk carrying exact per-cycle metadata
 */
export type ReconstructedCycle = {
  cycleId?: string;
  messageIds?: string[];
  observations: string;
  observedAt: Date | null;
  generationCount: number;
  source: 'boundary' | 'buffered-chunk' | 'generation-head' | 'reflection-head';
};

export type ReconstructionWarning = {
  kind: 'unparsable-date' | 'empty-chunk' | 'missing-generation' | 'duplicate-generation';
  generationCount: number;
  detail: string;
};

export type ReconstructionResult = {
  /** Replayable cycles, oldest-first. Reflection heads are never in here. */
  cycles: ReconstructedCycle[];
  /** Reflection heads, retained for inspection but never replayed. */
  excluded: ReconstructedCycle[];
  warnings: ReconstructionWarning[];
};

type OrderedCycle = ReconstructedCycle & { splitIndex: number };

/**
 * Convert the persisted OM records for a single thread into the ordered list of
 * observation cycles that produced them.
 *
 * Pure: no database, network, or model access.
 *
 * The one correctness rule that matters: a reflection generation's
 * `activeObservations` starts with the *reflection text*, not new observations
 * (see `createReflectionGeneration`). So the leading chunk is a real cycle for
 * generation 0 and a reflection for every generation above it. Treating them
 * alike would replay reflection prose through curation and repeat every earlier
 * cycle once per generation.
 */
export function reconstructCycles(records: ObservationalMemoryRecord[]): ReconstructionResult {
  const warnings: ReconstructionWarning[] = [];

  for (const record of records) {
    if (record.scope === 'resource') {
      throw new Error(
        `reconstructCycles: record ${record.id} has scope 'resource'. Resource-scoped observations are ` +
          `grouped into <thread id="..."> sections and need a different reconstruction; only 'thread' scope is supported.`,
      );
    }
  }

  const ordered = [...records].sort((a, b) => a.generationCount - b.generationCount);

  const seenGenerations = new Set<number>();
  for (const record of ordered) {
    if (seenGenerations.has(record.generationCount)) {
      throw new Error(
        `reconstructCycles: more than one record carries generationCount ${record.generationCount}; ` +
          `replay would double-count that generation`,
      );
    }
    seenGenerations.add(record.generationCount);
  }
  for (let generation = 0; generation < (ordered.at(-1)?.generationCount ?? -1); generation++) {
    if (!seenGenerations.has(generation)) {
      warnings.push({
        kind: 'missing-generation',
        generationCount: generation,
        detail: `no record found for generationCount ${generation}; cycles from that generation are unrecoverable`,
      });
    }
  }

  const cycles: OrderedCycle[] = [];
  const excluded: ReconstructedCycle[] = [];

  for (const record of ordered) {
    const generationCount = record.generationCount;
    let splitIndex = 0;

    // [chunk0, date1, chunk1, date2, chunk2, ...] — chunk0 has no preceding boundary.
    const parts = (record.activeObservations ?? '').split(BOUNDARY_WITH_DATE_RE);

    const head = parts[0]?.trim();
    if (head) {
      const headCycle: ReconstructedCycle = {
        observations: head,
        observedAt: null,
        generationCount,
        source: generationCount === 0 ? 'generation-head' : 'reflection-head',
      };
      if (generationCount === 0) {
        cycles.push({ ...headCycle, splitIndex: splitIndex++ });
      } else {
        excluded.push(headCycle);
        splitIndex++;
      }
    } else if (parts.length > 1) {
      warnings.push({
        kind: 'empty-chunk',
        generationCount,
        detail: 'leading chunk was empty',
      });
      splitIndex++;
    }

    for (let i = 1; i < parts.length; i += 2) {
      const dateStr = parts[i]!;
      const chunk = parts[i + 1]?.trim();
      const index = splitIndex++;

      if (!chunk) {
        warnings.push({
          kind: 'empty-chunk',
          generationCount,
          detail: `chunk following boundary ${dateStr} was empty`,
        });
        continue;
      }

      const boundaryDate = new Date(dateStr);
      const parsed = isNaN(boundaryDate.getTime()) ? null : boundaryDate;
      if (!parsed) {
        warnings.push({
          kind: 'unparsable-date',
          generationCount,
          detail: `boundary date ${dateStr} could not be parsed; cycle kept with a null timestamp`,
        });
      }

      cycles.push({
        observations: chunk,
        observedAt: parsed,
        generationCount,
        source: 'boundary',
        splitIndex: index,
      });
    }

    // Buffered chunks were already observed (and already curated — the curator
    // Extractor runs at observe-time), they just had not been activated yet.
    // They carry exact per-cycle metadata, so nothing here is inferred.
    for (const chunk of record.bufferedObservationChunks ?? []) {
      const observations = chunk.observations?.trim();
      if (!observations) {
        warnings.push({
          kind: 'empty-chunk',
          generationCount,
          detail: `buffered chunk ${chunk.cycleId} had no observations`,
        });
        continue;
      }
      cycles.push({
        cycleId: chunk.cycleId,
        messageIds: chunk.messageIds,
        observations,
        observedAt: chunk.lastObservedAt ? new Date(chunk.lastObservedAt) : null,
        generationCount,
        source: 'buffered-chunk',
        splitIndex: splitIndex++,
      });
    }
  }

  cycles.sort((a, b) => {
    if (a.generationCount !== b.generationCount) return a.generationCount - b.generationCount;
    const aTime = a.observedAt?.getTime();
    const bTime = b.observedAt?.getTime();
    if (aTime !== undefined && bTime !== undefined && aTime !== bTime) return aTime - bTime;
    return a.splitIndex - b.splitIndex;
  });

  return {
    cycles: cycles.map(({ splitIndex: _splitIndex, ...cycle }) => cycle),
    excluded,
    warnings,
  };
}
