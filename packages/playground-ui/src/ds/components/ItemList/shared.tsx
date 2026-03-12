import { type ItemListColumn } from './types';

export function getItemListColumnTemplate(columns?: ItemListColumn[]): string {
  if (!columns || columns.length === 0) {
    return '';
  }

  return columns
    ?.map(column => {
      return column.size;
    })
    .join(' ');
}
