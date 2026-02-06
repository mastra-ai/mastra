'use client';

import { Table, Thead, Tbody, Th, Row, Cell } from '@/ds/components/Table';

export interface CSVPreviewTableProps {
  headers: string[];
  data: Record<string, unknown>[];
  maxRows?: number;
}

/**
 * Preview table showing parsed CSV data.
 * Displays first N rows with truncated cell values.
 */
export function CSVPreviewTable({ headers, data, maxRows = 5 }: CSVPreviewTableProps) {
  const displayData = data.slice(0, maxRows);
  const totalRows = data.length;

  // Truncate long values for display
  const truncateValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return str.length > 50 ? str.slice(0, 47) + '...' : str;
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border border-border1">
        <Table size="small">
          <Thead>
            {headers.map((header: string) => (
              <Th key={header}>{header}</Th>
            ))}
          </Thead>
          <Tbody>
            {displayData.map((row: Record<string, unknown>, rowIndex: number) => (
              <Row key={rowIndex}>
                {headers.map((header: string) => (
                  <Cell key={header} className="text-sm max-w-[200px]">
                    <span className="truncate block">{truncateValue(row[header])}</span>
                  </Cell>
                ))}
              </Row>
            ))}
          </Tbody>
        </Table>
      </div>

      {/* Row count indicator */}
      <div className="text-xs text-neutral4">
        {displayData.length < totalRows
          ? `Showing ${displayData.length} of ${totalRows} rows`
          : `${totalRows} row${totalRows !== 1 ? 's' : ''}`}
      </div>
    </div>
  );
}
