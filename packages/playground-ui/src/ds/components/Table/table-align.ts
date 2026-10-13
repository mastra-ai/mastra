export type TableAlign = 'start' | 'center' | 'end';

export const tableAlignClasses: Record<TableAlign, string> = {
  start: 'text-left',
  center: 'text-center',
  end: 'text-right',
};

export function resolveTableAlign(align: string | undefined): TableAlign {
  if (align === 'center') return 'center';
  if (align === 'end' || align === 'right') return 'end';
  return 'start';
}
