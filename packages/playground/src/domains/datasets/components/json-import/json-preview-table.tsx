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
    <div className="border-border1 overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface2 border-border1 border-b">
            <th className="text-neutral3 w-8 px-3 py-2 text-left font-medium">#</th>
            <th className="text-neutral3 px-3 py-2 text-left font-medium">Input</th>
            <th className="text-neutral3 px-3 py-2 text-left font-medium">Ground Truth</th>
            <th className="text-neutral3 w-24 px-3 py-2 text-left font-medium">Metadata</th>
          </tr>
        </thead>
        <tbody>
          {displayItems.map((item: ImportableItem, index: number) => (
            <tr key={index} className="border-border1 border-b last:border-b-0">
              <td className="text-neutral4 px-3 py-2">{index + 1}</td>
              <td className="text-neutral1 px-3 py-2 font-mono text-xs">{truncateValue(item.input)}</td>
              <td className="text-neutral2 px-3 py-2 font-mono text-xs">{truncateValue(item.groundTruth)}</td>
              <td className="text-neutral3 px-3 py-2 text-xs">
                {item.metadata ? `${Object.keys(item.metadata).length} keys` : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {hiddenCount > 0 && (
        <div className="bg-surface2 text-neutral4 border-border1 border-t px-3 py-2 text-center text-xs">
          +{hiddenCount} more item{hiddenCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
