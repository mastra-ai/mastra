import type { DatasetExperimentResult } from '@mastra/client-js';

/** Minimal shape needed to read output text and errors; review items may omit target info. */
export type ResultOutputSource = {
  targetType?: DatasetExperimentResult['targetType'];
  output?: unknown;
  error?: unknown;
};

function readString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object' || !(key in value)) return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' && field ? field : undefined;
}

/** Agent text output; undefined for non-agent targets or empty text. */
export function getResultOutputText(result: ResultOutputSource): string | undefined {
  if (result.targetType !== 'agent') return undefined;
  return readString(result.output, 'text');
}

/**
 * One-line output for list cells. Agent results show their text; results with no target type
 * (e.g. submitted externally) fall back to the raw string or compact JSON.
 */
export function getResultOutputPreview(result: ResultOutputSource): string | undefined {
  if (result.targetType) return getResultOutputText(result);
  const { output } = result;
  if (output === null || output === undefined || output === '') return undefined;
  return typeof output === 'string' ? output : JSON.stringify(output);
}

/** Output/Error list columns, each included only when some result has a value for it. */
export function getOptionalResultColumns(results: ResultOutputSource[]) {
  const columns: { name: string; label: string; size: string }[] = [];
  if (results.some(r => getResultOutputPreview(r))) columns.push({ name: 'output', label: 'Output', size: '1fr' });
  if (results.some(r => getResultErrorMessage(r))) columns.push({ name: 'error', label: 'Error', size: '1fr' });
  return columns;
}

/** Top-level error message, falling back to the agent output's error. */
export function getResultErrorMessage(result: ResultOutputSource): string | undefined {
  const topLevel = readString(result.error, 'message');
  if (topLevel) return topLevel;
  if (result.targetType !== 'agent' || !result.output || typeof result.output !== 'object') return undefined;
  return readString((result.output as Record<string, unknown>).error, 'message');
}
