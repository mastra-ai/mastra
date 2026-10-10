import { TableBody } from './table-body';
import { TableCell } from './table-cell';
import { TableHead } from './table-head';
import { TableHeader } from './table-header';
import { TableRoot } from './table-root';
import { TableRow } from './table-row';
import { TableRowLink } from './table-row-link';

export type { TableAlign } from './table-align';
export type { TableBodyProps } from './table-body';
export type { TableCellProps, TableCellTone } from './table-cell';
export type { TableHeadProps } from './table-head';
export type { TableHeaderProps } from './table-header';
export type { TableProps } from './table-root';
export type { TableRowProps } from './table-row';
export type { TableRowLinkProps } from './table-row-link';

export const Table = Object.assign(TableRoot, {
  Header: TableHeader,
  Body: TableBody,
  Row: TableRow,
  Head: TableHead,
  Cell: TableCell,
  RowLink: TableRowLink,
});
