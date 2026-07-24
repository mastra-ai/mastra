'use client';

import { DataList } from '@mastra/playground-ui/components/DataList';

export interface CSVPreviewTableProps {
  headers: string[];
  data: Record<string, unknown>[];
  maxRows?: number;
}

// Truncate long values for display.
function truncateValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return str.length > 50 ? str.slice(0, 47) + '...' : str;
}

/**
 * Preview table showing parsed CSV data.
 * Displays first N rows with truncated cell values.
 */
export function CSVPreviewTable({ headers, data, maxRows = 5 }: CSVPreviewTableProps) {
  const displayData = data.slice(0, maxRows);
  const totalRows = data.length;
  const columns = headers.map((_, index) => (index === 0 ? 'minmax(10rem, 14rem)' : 'minmax(8rem, 12rem)')).join(' ');

  return (
    <div className="flex flex-col gap-2">
      {headers.length > 0 ? (
        <DataList
          columns={columns}
          variant="lined"
          className="max-h-80 rounded-lg border border-border1"
          mask={{ left: false }}
          stickyHeaderBackground="tinted"
        >
          <DataList.Top>
            {headers.map((header: string, index: number) => (
              <DataList.TopCell key={`${index}-${header}`} sticky={index === 0 ? 'start' : undefined}>
                {header}
              </DataList.TopCell>
            ))}
          </DataList.Top>
          {displayData.map((row: Record<string, unknown>, rowIndex: number) => {
            return (
              <DataList.RowStatic key={rowIndex}>
                {headers.map((header: string, index: number) => {
                  const value = truncateValue(row[header]);

                  if (index === 0) {
                    return (
                      <DataList.RowHeaderCell
                        key={`${index}-${header}`}
                        height="compact"
                        className="max-w-[14rem] text-ui-sm"
                      >
                        {value}
                      </DataList.RowHeaderCell>
                    );
                  }

                  return (
                    <DataList.Cell key={`${index}-${header}`} height="compact" className="max-w-[12rem] text-ui-sm">
                      <span className="block truncate">{value}</span>
                    </DataList.Cell>
                  );
                })}
              </DataList.RowStatic>
            );
          })}
        </DataList>
      ) : null}

      {/* Row count indicator */}
      <div className="text-xs text-neutral4">
        {displayData.length < totalRows
          ? `Showing ${displayData.length} of ${totalRows} rows`
          : `${totalRows} row${totalRows !== 1 ? 's' : ''}`}
      </div>
    </div>
  );
}
