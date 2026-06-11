import type { DatasetExperiment, DatasetExperimentResult, ToolReplayOnMiss, ToolReplayReport } from '@mastra/client-js';

export interface ToolReplayMarker {
  fromExperimentId?: string;
  onMiss: ToolReplayOnMiss;
}

/**
 * Reads the replay marker an experiment run with `toolReplay` is stamped with
 * (`metadata.toolReplay = { fromExperimentId, onMiss }`). Metadata is
 * user-writable, so this matches the exact shape the backend stamps — an
 * object carrying `onMiss` — mirroring the core source-experiment guard;
 * arbitrary user `toolReplay` keys never read as replay runs.
 */
export function getReplayMarker(experiment: Pick<DatasetExperiment, 'metadata'>): ToolReplayMarker | null {
  const marker = experiment.metadata?.toolReplay;
  if (typeof marker !== 'object' || marker === null || !('onMiss' in marker)) return null;
  const { fromExperimentId, onMiss } = marker as Record<string, unknown>;
  return {
    ...(typeof fromExperimentId === 'string' ? { fromExperimentId } : {}),
    onMiss: onMiss === 'passthrough' ? 'passthrough' : 'error',
  };
}

export function isReplayExperiment(experiment: Pick<DatasetExperiment, 'metadata'>): boolean {
  return getReplayMarker(experiment) !== null;
}

/**
 * Extracts the divergence report a replay run merges into the stored result
 * output (`output.toolReplay`). Shape-checked so a user-owned `toolReplay`
 * key in an arbitrary agent output is never mistaken for a report.
 */
export function getToolReplayReport(result: Pick<DatasetExperimentResult, 'output'>): ToolReplayReport | null {
  const output = result.output;
  if (typeof output !== 'object' || output === null || Array.isArray(output)) return null;
  const report = (output as Record<string, unknown>).toolReplay;
  if (typeof report !== 'object' || report === null || Array.isArray(report)) return null;
  const candidate = report as Partial<ToolReplayReport>;
  if (
    typeof candidate.totalRecorded !== 'number' ||
    typeof candidate.replayedCount !== 'number' ||
    !Array.isArray(candidate.misses)
  ) {
    return null;
  }
  return report as ToolReplayReport;
}

/**
 * Returns the output without the injected `toolReplay` key for display — the
 * report renders in its own section. A failure-only output (`{ toolReplay }`
 * and nothing else) becomes null so the panel renders its empty placeholder.
 */
export function stripToolReplayFromOutput(output: unknown): unknown {
  if (typeof output !== 'object' || output === null || Array.isArray(output)) return output;
  if (!('toolReplay' in output)) return output;
  const { toolReplay: _toolReplay, ...rest } = output as Record<string, unknown>;
  return Object.keys(rest).length > 0 ? rest : null;
}

const TOOL_REPLAY_ERROR_LABELS: Record<string, string> = {
  TOOL_REPLAY_MISS: 'A tool call had no remaining recorded event — the item stopped instead of running live.',
  TOOL_REPLAY_NO_RECORDING: 'No recording was found for this item — it never ran (live execution is never silent).',
  TOOL_REPLAY_LOAD_FAILED: 'The recording could not be loaded from storage for this item.',
};

export function getToolReplayErrorLabel(code: string | undefined): string | null {
  if (!code) return null;
  return TOOL_REPLAY_ERROR_LABELS[code] ?? null;
}

export type ReplayDivergence = 'clean' | 'misses' | 'arg-mismatches' | 'unconsumed-only';

/** Worst-signal-first classification used by row chips and summaries. */
export function classifyReplayDivergence(report: ToolReplayReport): ReplayDivergence {
  if (report.misses.length > 0) return 'misses';
  if (report.argMismatches.length > 0) return 'arg-mismatches';
  if (report.unconsumed.length > 0) return 'unconsumed-only';
  return 'clean';
}
