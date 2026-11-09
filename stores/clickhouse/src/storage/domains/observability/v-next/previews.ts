/**
 * Stored span previews (`inputPreview` / `outputPreview` / `errorPreview`).
 *
 * The writer stores each preview in core's `buildPreview` format, `''` when there is nothing to
 * preview. A NULL preview means the row was written before the columns existed; readers fetch the
 * payload columns for just those rows and build the same preview from them.
 */
import { needsPreview, readPreview } from './preview-compat';

export const PREVIEW_COLUMNS = ['inputPreview', 'outputPreview', 'errorPreview'] as const;

/** Payload column each preview is built from. */
export const PREVIEW_PAYLOAD_COLUMNS = {
  inputPreview: 'input',
  outputPreview: 'output',
  errorPreview: 'error',
} as const;

export type StoredPreviews = Record<(typeof PREVIEW_COLUMNS)[number], string | null>;

/** Whether a row was written before previews were stored, so it needs its payload columns. */
export function needsPreviewPayloads(row: Record<string, unknown>): boolean {
  return PREVIEW_COLUMNS.some(column => needsPreview(row[column]));
}

/**
 * The previews a list returns for a row: the stored ones (`''` becomes `null`), or for a row written
 * before they were stored, built from the payload columns on `payloads` (default: the row itself).
 */
export function resolveStoredPreviews(
  row: Record<string, unknown>,
  payloads: Record<string, unknown> | undefined = row,
): StoredPreviews {
  const previews = {} as StoredPreviews;
  for (const column of PREVIEW_COLUMNS) {
    const stored = row[column];
    previews[column] = readPreview(stored, payloads?.[PREVIEW_PAYLOAD_COLUMNS[column]], true);
  }
  return previews;
}
