/** Expected structure of an imported item */
export interface ImportableItem {
  input: unknown;
  groundTruth?: unknown;
  metadata?: Record<string, unknown>;
}

/** One row of the import preview, derived from the raw array element */
export interface JSONPreviewRow {
  index: number;
  input: unknown;
  hasInput: boolean;
  hasGroundTruth: boolean;
}

export type JSONImportValidation =
  | { status: 'idle' }
  | { status: 'error'; kind: 'parse'; message: string }
  | { status: 'error'; kind: 'not-array' }
  | { status: 'error'; kind: 'missing-input'; rows: JSONPreviewRow[]; missingInputCount: number; total: number }
  | {
      status: 'ready';
      rows: JSONPreviewRow[];
      items: ImportableItem[];
      missingGroundTruthCount: number;
      total: number;
    };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

/**
 * Validate raw JSON text for dataset import.
 * Drives both the preview rows and the footer status of the import dialog.
 */
export function validateImportJSON(text: string): JSONImportValidation {
  if (text.trim() === '') {
    return { status: 'idle' };
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return { status: 'error', kind: 'parse', message: err instanceof Error ? err.message : String(err) };
  }

  if (!Array.isArray(data) || data.length === 0) {
    return { status: 'error', kind: 'not-array' };
  }

  const rows: JSONPreviewRow[] = data.map((element, index) => {
    const item = isPlainObject(element) ? element : {};
    return {
      index: index + 1,
      input: item.input,
      hasInput: hasValue(item.input),
      hasGroundTruth: hasValue(item.groundTruth),
    };
  });

  const total = rows.length;
  const missingInputCount = rows.filter(row => !row.hasInput).length;
  if (missingInputCount > 0) {
    return { status: 'error', kind: 'missing-input', rows, missingInputCount, total };
  }

  const items: ImportableItem[] = (data as Record<string, unknown>[]).map(item => ({
    input: item.input,
    groundTruth: item.groundTruth,
    metadata: isPlainObject(item.metadata) ? item.metadata : undefined,
  }));

  return {
    status: 'ready',
    rows,
    items,
    missingGroundTruthCount: rows.filter(row => !row.hasGroundTruth).length,
    total,
  };
}
