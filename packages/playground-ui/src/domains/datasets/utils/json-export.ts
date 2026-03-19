import type { DatasetItem } from '@mastra/client-js';

/**
 * Export dataset items to JSON and trigger download
 */
export function exportItemsToJSON(items: DatasetItem[], filename: string): void {
  // Map items to export format
  const data = items.map(item => ({
    input: item.input,
    groundTruth: item.groundTruth,
    metadata: item.metadata,
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
  }));

  // Generate formatted JSON
  const json = JSON.stringify(data, null, 2);

  // Create and trigger download
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
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
