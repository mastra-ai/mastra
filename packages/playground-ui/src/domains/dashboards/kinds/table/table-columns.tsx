import { BreakdownChangeDescription } from '../../../metrics/components/breakdown/breakdown-change-description';
import { BreakdownFigure } from '../../../metrics/components/breakdown/breakdown-figure';
import type { Change, TableColumn, TableRow, ValueColumn } from '../../lib/table';
import { TableChangeCell, TableDimensionCell, TableNameCell, TableValueCell } from './table-cells';
import type { MetricsTableColumn } from '@/ds/components/MetricsTable';

/** The MetricsTable column for one of the view's columns. */
export function tableColumn(
  column: TableColumn,
  window: { start: Date; end: Date },
  compared: ValueColumn | undefined,
  changeOf: (row: TableRow) => Change | undefined,
): MetricsTableColumn<TableRow> {
  const o = column.options;
  const base = { id: column.id, header: column.label, description: o.description };
  switch (o.type) {
    case 'name':
      return {
        ...base,
        width: o.width,
        sortValue: o.sortable ? (row: TableRow) => row.name : undefined,
        firstDirection: 'asc',
        cell: row => <TableNameCell options={o} row={row} />,
      };
    case 'dimension':
      return {
        ...base,
        width: o.width,
        sortValue: o.sortable
          ? (row: TableRow) => (o.query === undefined ? row.dimensions[o.dimension] : row.lookups[column.id])
          : undefined,
        firstDirection: 'asc',
        cell: row => <TableDimensionCell id={column.id} options={o} row={row} />,
      };
    case 'value': {
      const value: ValueColumn = { id: column.id, label: column.label, options: o };
      return {
        ...base,
        align: 'end',
        width: o.width,
        sortValue: o.sortable === false ? undefined : (row: TableRow) => row.values[column.id],
        cell: row => <TableValueCell column={value} row={row} />,
      };
    }
    case 'change':
      return {
        id: column.id,
        header: column.label,
        align: 'end',
        description: o.description ?? <BreakdownChangeDescription window={window} label={compared?.label ?? ''} />,
        // Sorted by the change shown: biggest rise first, biggest fall first the other way. New rows
        // have no change to rank, so they sort last.
        sortValue: row => changeOf(row)?.change,
        cell: row => (
          <BreakdownFigure>{compared && <TableChangeCell change={changeOf(row)} column={compared} />}</BreakdownFigure>
        ),
      };
  }
}
