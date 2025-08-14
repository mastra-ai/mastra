export type Column = {
  name: string;
  label: string;
  size: string;
};

export function getColumnTemplate(columns?: Column[]): string {
  if (!columns || columns.length === 0) {
    return '';
  }

  return columns
    ?.map(column => {
      return column.size;
    })
    .join(' ');
}
