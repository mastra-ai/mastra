import type { ComponentProps } from 'react';

export type TableAlign = 'start' | 'center' | 'end';

type NativeCellAlign = ComponentProps<'td'>['align'];

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

export function toNativeAlign(align: TableAlign | NativeCellAlign): NativeCellAlign {
  if (align === 'start') return 'left';
  if (align === 'end') return 'right';
  return align;
}
