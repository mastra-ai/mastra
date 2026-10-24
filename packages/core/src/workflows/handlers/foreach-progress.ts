/**
 * Foreach items that finished while the foreach was still running, keyed by
 * item index. The default engine checkpoints this under
 * `metadata.foreachProgress` on the foreach step's running result so a restart
 * after a crash skips items that already ran (#26214). It is removed once the
 * foreach ends and never appears in a final step result.
 */
export type ForeachProgress = Record<number, { output: unknown; nestedRunId?: string }>;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isForeachProgress(value: unknown): value is ForeachProgress {
  if (!isPlainRecord(value)) return false;
  return Object.values(value).every(
    entry =>
      isPlainRecord(entry) &&
      'output' in entry &&
      (entry.nestedRunId === undefined || typeof entry.nestedRunId === 'string'),
  );
}

/** The checkpointed foreach progress on a foreach step's running result, if any. */
export function getForeachProgress(stepResult: { metadata?: unknown } | undefined): ForeachProgress | undefined {
  const metadata = stepResult?.metadata;
  if (!isPlainRecord(metadata)) return undefined;
  const progress = metadata.foreachProgress;
  return isForeachProgress(progress) ? progress : undefined;
}

/** Copy of `stepInfo` without `metadata.foreachProgress`; drops `metadata` if nothing else is left. */
export function omitForeachProgress<T extends { metadata?: unknown }>(
  stepInfo: T,
): Omit<T, 'metadata'> & { metadata?: Record<string, unknown> } {
  const { metadata, ...rest } = stepInfo;
  if (!isPlainRecord(metadata)) return rest;
  const { foreachProgress: _foreachProgress, ...others } = metadata;
  return Object.keys(others).length > 0 ? { ...rest, metadata: others } : rest;
}
