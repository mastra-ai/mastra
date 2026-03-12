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
    <div className="border border-border1 rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface2 border-b border-border1">
            <th className="px-3 py-2 text-left font-medium text-neutral3 w-8">#</th>
            <th className="px-3 py-2 text-left font-medium text-neutral3">Input</th>
            <th className="px-3 py-2 text-left font-medium text-neutral3">Ground Truth</th>
            <th className="px-3 py-2 text-left font-medium text-neutral3 w-24">Metadata</th>
          </tr>
        </thead>
        <tbody>
          {displayItems.map((item: ImportableItem, index: number) => (
            <tr key={index} className="border-b border-border1 last:border-b-0">
              <td className="px-3 py-2 text-neutral4">{index + 1}</td>
              <td className="px-3 py-2 text-neutral1 font-mono text-xs">{truncateValue(item.input)}</td>
              <td className="px-3 py-2 text-neutral2 font-mono text-xs">{truncateValue(item.groundTruth)}</td>
              <td className="px-3 py-2 text-neutral3 text-xs">
                {item.metadata ? `${Object.keys(item.metadata).length} keys` : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {hiddenCount > 0 && (
        <div className="bg-surface2 px-3 py-2 text-xs text-neutral4 text-center border-t border-border1">
          +{hiddenCount} more item{hiddenCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
