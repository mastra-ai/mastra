import { z } from 'zod/v4';

export const columnWidthsSchema = z.record(z.string(), z.number().positive());

export type DataListColumnWidths = z.infer<typeof columnWidthsSchema>;

export const getColumnWidthsStorageKey = (id: string) => `mastra:data-list:column-widths:${id}`;

export const MIN_COLUMN_WIDTH = 48;

/** Storage key of a column: its `columnKeys` entry when present, otherwise its original index. */
export const getColumnWidthKey = (index: number, columnKeys?: string[]) => columnKeys?.[index] ?? String(index);

/**
 * Replaces the tracks of resized columns with fixed pixel widths. Stored entries
 * that match no column (unknown keys, out-of-range indexes) are ignored.
 */
export function applyColumnWidths(
  tracks: string[],
  widths: DataListColumnWidths | undefined,
  columnKeys?: string[],
): string[] {
  if (!widths) return tracks;
  return tracks.map((track, index) => {
    const width = widths[getColumnWidthKey(index, columnKeys)];
    return width === undefined ? track : `${width}px`;
  });
}
