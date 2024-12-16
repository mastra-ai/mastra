'use client';

import { ColumnDef, OnChangeFn, RowSelectionState, Table, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { createContext, useContext, useMemo } from 'react';

export interface HighlightedCellsConfig {
  startRowIndex: number;
  /*
   * Could be negative
   */
  rowSpan: number;
  startColIndex: number;
  /*
   * Could be negative
   */
  colSpan: number;
}

interface TableContextType<TData> {
  table?: Table<TData>;
  isRowSelectionEnabled: boolean;
  data?: TData[];
  setRowSelection?: OnChangeFn<RowSelectionState>;
  rowSelection?: RowSelectionState;
  getRowLockCondition?: (row: TData) => boolean;
  columnSizeVars: {
    [key: string]: number;
  };
}

const TableContext = createContext<TableContextType<any>>({
  isRowSelectionEnabled: false,
  columnSizeVars: {} as { [key: string]: number },
});

export const useTableContext = () => {
  const ctx = useContext(TableContext);
  if (!ctx) {
    throw new Error('useTableContext must be used within a TableProvider');
  }
  return ctx;
};

export interface TableProviderProps<TData, TValue> {
  children: React.ReactNode;
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  setRowSelection?: OnChangeFn<RowSelectionState>;
  rowSelection?: RowSelectionState;
  rowLockCondition?: (row: TData) => boolean;
}

const initialTableData: any[] = [];
const initialColumnDefs: ColumnDef<any, any>[] = [];

export const TableProvider = <TData, TValue>({
  columns,
  data,
  rowSelection,
  setRowSelection,
  rowLockCondition,
  children,
}: TableProviderProps<TData, TValue>) => {
  const memoizedColumns = useMemo(() => (columns.length ? columns : initialColumnDefs), [columns]);
  const memoizedData = useMemo(() => (data?.length ? data : initialTableData), [data]);

  const table = useReactTable({
    data: memoizedData,
    columns: memoizedColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: row => row.id,
    manualPagination: true,
    ...(setRowSelection
      ? {
          onRowSelectionChange: setRowSelection,
          state: { rowSelection },
        }
      : {}),

    defaultColumn: {
      size: 200, //starting column size
      minSize: 50, //enforced during column resizing
      maxSize: 600, //enforced during column resizing
    },
    columnResizeMode: 'onChange',
  });

  const columnSizingInfo = table.getState().columnSizingInfo;
  const columnSizing = table.getState().columnSizing;

  const columnSizeVars = useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return colSizes;
  }, [table]);

  const memoizedValue: TableContextType<TData> = useMemo(
    () => ({
      table,
      data: memoizedData,
      isRowSelectionEnabled: !!setRowSelection,
      rowSelection,
      setRowSelection,
      getRowLockCondition: rowLockCondition,
      columnSizeVars,
    }),
    [rowSelection, memoizedData, setRowSelection, table, rowLockCondition, columnSizeVars],
  );

  return <TableContext.Provider value={memoizedValue}>{children}</TableContext.Provider>;
};
