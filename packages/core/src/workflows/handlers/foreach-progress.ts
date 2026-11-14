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

// `output` may be absent: JSON storage drops `output: undefined`, which reads back as undefined.
function isForeachProgress(value: unknown): value is ForeachProgress {
  if (!isPlainRecord(value)) return false;
  return Object.values(value).every(
    entry => isPlainRecord(entry) && (entry.nestedRunId === undefined || typeof entry.nestedRunId === 'string'),
  );
}

/** The checkpointed foreach progress on a foreach step's running result, if any. */
export function getForeachProgress(stepResult: { metadata?: unknown } | undefined): ForeachProgress | undefined {
  const metadata = stepResult?.metadata;
  if (!isPlainRecord(metadata)) return undefined;
  const progress = metadata.foreachProgress;
  return isForeachProgress(progress) ? progress : undefined;
}

/**
 * Which items the `resumePayload` on a foreach step's running result belongs to, stored next to
 * the progress under `metadata.foreachResumeTarget`: the index of the resumed item, `'all'` for a
 * resume without an index (every item suspended at the time), `'none'` when the foreach was
 * entered without a resume. A restart hands the stored payload only to those items.
 */
export type ForeachResumeTarget = number | 'all' | 'none';

/** The stored resume target on a foreach step's running result; undefined if none was recorded. */
export function getForeachResumeTarget(
  stepResult: { metadata?: unknown } | undefined,
): ForeachResumeTarget | undefined {
  const metadata = stepResult?.metadata;
  if (!isPlainRecord(metadata)) return undefined;
  const target = metadata.foreachResumeTarget;
  return target === 'all' || target === 'none' || (typeof target === 'number' && Number.isInteger(target))
    ? target
    : undefined;
}

/** Whether a restart hands the stored `resumePayload` of a running foreach result to item `index`. */
export function takesStoredForeachResume(
  stepResult: { metadata?: unknown; suspendPayload?: any } | undefined,
  index: number,
): boolean {
  const target = getForeachResumeTarget(stepResult);
  if (target === 'all') {
    return stepResult?.suspendPayload?.__workflow_meta?.foreachOutput?.[index]?.status === 'suspended';
  }
  return target === index;
}

/**
 * What the resume of a nested workflow step targeted inside the nested run (the step path below
 * the nested workflow, the resume label, the foreach item), stored under
 * `metadata.nestedResumeTarget` on the step's running result. A restart that has to resume the
 * nested run resumes only that.
 */
export type NestedResumeTarget = { steps: string[]; label?: string; forEachIndex?: number };

/** The stored nested resume target on a nested workflow step's running result, if any. */
export function getNestedResumeTarget(stepResult: { metadata?: unknown } | undefined): NestedResumeTarget | undefined {
  const metadata = stepResult?.metadata;
  if (!isPlainRecord(metadata)) return undefined;
  const target = metadata.nestedResumeTarget;
  if (!isPlainRecord(target) || !Array.isArray(target.steps)) return undefined;
  if (!target.steps.every(step => typeof step === 'string')) return undefined;
  if (target.label !== undefined && typeof target.label !== 'string') return undefined;
  if (target.forEachIndex !== undefined && !Number.isInteger(target.forEachIndex)) return undefined;
  return {
    steps: target.steps,
    ...(target.label !== undefined ? { label: target.label } : {}),
    ...(target.forEachIndex !== undefined ? { forEachIndex: target.forEachIndex as number } : {}),
  };
}

/**
 * Copy of `stepInfo` without the keys only a running result carries (`metadata.foreachProgress`,
 * `metadata.foreachResumeTarget`, `metadata.nestedResumeTarget`); drops `metadata` if nothing
 * else is left.
 */
export function omitForeachProgress<T extends { metadata?: unknown }>(
  stepInfo: T,
): Omit<T, 'metadata'> & { metadata?: Record<string, unknown> } {
  const { metadata, ...rest } = stepInfo;
  if (!isPlainRecord(metadata)) return rest;
  const {
    foreachProgress: _foreachProgress,
    foreachResumeTarget: _foreachResumeTarget,
    nestedResumeTarget: _nestedResumeTarget,
    ...others
  } = metadata;
  return Object.keys(others).length > 0 ? { ...rest, metadata: others } : rest;
}
