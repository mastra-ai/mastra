import { DataList } from '@mastra/playground-ui';
import Papa from 'papaparse';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

export const MAX_PREVIEW_COLUMNS = 50;
export const MAX_PREVIEW_ROWS = 200;

export type WorkspaceDataListHeaderMode = 'first-row' | 'letters';

export interface WorkspaceDataListPreviewProps {
  caption?: string;
  headerMode?: WorkspaceDataListHeaderMode;
  isRowTruncated?: boolean;
  rows: string[][];
}

export interface WorkspaceDelimitedDataListPreviewProps {
  content: string;
  fileName: string;
  type: 'csv' | 'tsv';
}

function normalizeCellValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function normalizeRows(rows: unknown[][]) {
  return rows.map(row => row.map(normalizeCellValue));
}

function columnName(index: number) {
  let name = '';
  let value = index + 1;

  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }

  return name;
}

function getColumnCount(rows: string[][]) {
  return Math.min(Math.max(1, ...rows.map(row => row.length)), MAX_PREVIEW_COLUMNS);
}

function getCell(row: string[] | undefined, index: number) {
  return row?.[index] ?? '';
}

function getColumnTemplate(columnCount: number) {
  return Array.from({ length: columnCount }, (_, index) =>
    index === 0 ? 'minmax(10rem, 1.25fr)' : 'minmax(8rem, 1fr)',
  ).join(' ');
}

function parseDelimitedContent(content: string, type: 'csv' | 'tsv') {
  const result = Papa.parse<string[]>(content, {
    delimiter: type === 'tsv' ? '\t' : undefined,
    preview: MAX_PREVIEW_ROWS + 2,
    skipEmptyLines: false,
  });

  return {
    rows: normalizeRows(result.data),
    errors: result.errors,
    isTruncated: result.meta.truncated,
  };
}

export function WorkspaceDataListPreview({
  caption,
  isRowTruncated = false,
  rows,
  headerMode = 'first-row',
}: WorkspaceDataListPreviewProps) {
  const nonEmptyRows = rows.filter(row => row.some(cell => cell.length > 0));
  const columnCount = getColumnCount(nonEmptyRows);
  const headers =
    headerMode === 'first-row'
      ? Array.from({ length: columnCount }, (_, index) => getCell(nonEmptyRows[0], index) || columnName(index))
      : Array.from({ length: columnCount }, (_, index) => columnName(index));
  const bodyRows = headerMode === 'first-row' ? nonEmptyRows.slice(1) : nonEmptyRows;
  const visibleRows = bodyRows.slice(0, MAX_PREVIEW_ROWS);
  const isColumnClipped = nonEmptyRows.some(row => row.length > MAX_PREVIEW_COLUMNS);
  const isRowClipped = isRowTruncated || bodyRows.length > visibleRows.length;
  const columnTemplate = getColumnTemplate(columnCount);

  if (nonEmptyRows.length === 0) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm font-medium text-neutral6">No rows to preview</p>
          {caption ? <p className="mt-1 text-xs text-neutral4">{caption}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[280px] flex-col">
      {caption ? (
        <div className="border-b border-border1 px-4 py-2 text-xs text-neutral4">
          {caption}
          {isRowClipped || isColumnClipped ? (
            <span className="ml-2 text-neutral3">
              Showing {visibleRows.length.toLocaleString()}
              {isRowTruncated ? ' rows' : ` of ${bodyRows.length.toLocaleString()} rows`}
              {isColumnClipped ? ` and first ${MAX_PREVIEW_COLUMNS} columns` : ''}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        <DataList
          columns={columnTemplate}
          variant="lined"
          className={cn(
            'h-full rounded-none',
            '[&_.data-list-top]:rounded-none! [&_.data-list-row]:rounded-none!',
            '[&_.data-list-row]:hover:bg-transparent!',
          )}
        >
          <DataList.Top>
            {headers.map((header, index) => (
              <DataList.TopCell key={`${header}-${index}`} title={header}>
                {header}
              </DataList.TopCell>
            ))}
          </DataList.Top>

          {visibleRows.map((row, rowIndex) => (
            <DataList.RowStatic key={rowIndex}>
              {headers.map((_, columnIndex) => {
                const value = getCell(row, columnIndex);

                return (
                  <DataList.Cell
                    key={`${rowIndex}-${columnIndex}`}
                    height="compact"
                    className="items-start overflow-visible whitespace-pre-wrap py-2 text-neutral4"
                    title={value}
                  >
                    <span className="block min-w-0 whitespace-pre-wrap break-words">{value}</span>
                  </DataList.Cell>
                );
              })}
            </DataList.RowStatic>
          ))}
        </DataList>
      </div>
    </div>
  );
}

export function WorkspaceDelimitedDataListPreview({ content, fileName, type }: WorkspaceDelimitedDataListPreviewProps) {
  const { rows, errors, isTruncated } = useMemo(() => parseDelimitedContent(content, type), [content, type]);
  const warningCount = errors.length;

  return (
    <WorkspaceDataListPreview
      caption={`${fileName}${warningCount > 0 ? ` · parsed with ${warningCount} warning${warningCount === 1 ? '' : 's'}` : ''}`}
      headerMode="first-row"
      isRowTruncated={isTruncated}
      rows={rows}
    />
  );
}
