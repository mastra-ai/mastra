import { type EntryListColumn } from './types';

export function getColumnTemplate(columns?: EntryListColumn[]): string {
  if (!columns || columns.length === 0) {
    return '';
  }

  return columns
    ?.map(column => {
      return column.size;
    })
    .join(' ');
}
