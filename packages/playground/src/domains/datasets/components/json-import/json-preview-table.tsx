'use client';

import type { ImportableItem } from '../../utils/json-validation';

export interface JSONPreviewTableProps {
  items: ImportableItem[];
  maxRows?: number;
}

/**
 * Truncate a value for display
 */
function truncateValue(value: unknown, maxLength = 50): string {
  if (value === undefined || value === null) return '-';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

/**
 * Preview table for parsed JSON items
 */
export function JSONPreviewTable({ items, maxRows = 5 }: JSONPreviewTableProps) {
  const displayItems = items.slice(0, maxRows);
  const hiddenCount = items.length - maxRows;

  return (
    <div className="overflow-hidden rounded-md border border-border1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border1 bg-surface2">
            <th className="w-8 px-3 py-2 text-left font-medium text-neutral3">#</th>
            <th className="px-3 py-2 text-left font-medium text-neutral3">Input</th>
            <th className="px-3 py-2 text-left font-medium text-neutral3">Ground Truth</th>
            <th className="w-24 px-3 py-2 text-left font-medium text-neutral3">Metadata</th>
          </tr>
        </thead>
        <tbody>
          {displayItems.map((item: ImportableItem, index: number) => (
            <tr key={index} className="border-b border-border1 last:border-b-0">
              <td className="px-3 py-2 text-neutral4">{index + 1}</td>
              <td className="px-3 py-2 font-mono text-xs text-neutral1">{truncateValue(item.input)}</td>
              <td className="px-3 py-2 font-mono text-xs text-neutral2">{truncateValue(item.groundTruth)}</td>
              <td className="px-3 py-2 text-xs text-neutral3">
                {item.metadata ? `${Object.keys(item.metadata).length} keys` : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {hiddenCount > 0 && (
        <div className="border-t border-border1 bg-surface2 px-3 py-2 text-center text-xs text-neutral4">
          +{hiddenCount} more item{hiddenCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
