import Papa from 'papaparse';
import type { DatasetItem } from '@mastra/client-js';

/**
 * Export dataset items to CSV and trigger download
 * Columns: input, groundTruth, createdAt
 */
export function exportItemsToCSV(items: DatasetItem[], filename: string): void {
  // Map items to CSV rows
  const rows = items.map(item => ({
    input: formatValue(item.input),
    groundTruth: formatValue(item.groundTruth),
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt ?? ''),
  }));

  // Generate CSV with headers
  const csv = Papa.unparse(rows, {
    quotes: true,
    header: true,
  });

  // Create and trigger download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Format value for CSV cell
 * - string: keep as-is
 * - null/undefined: empty string
 * - object/array: JSON stringify
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  // Object or array: JSON stringify
  return JSON.stringify(value);
}
