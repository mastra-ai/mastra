import { type ColumnType } from './types';

export function getColumnTemplate(columns?: ColumnType[]): string {
  if (!columns || columns.length === 0) {
    return '';
  }

  return columns
    ?.map(column => {
      return column.size;
    })
    .join(' ');
}
