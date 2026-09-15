import '@/ds/primitives/focus.css';

export const dataListRowOuterStyles = [
  'ds-focus ds-focus-row group/data-list-row data-list-row col-span-full relative min-h-9 bg-surface2',
  'transition-colors duration-200',
] as const;

export const dataListRowStateStyles = [
  'hover:bg-surface3 active:bg-surface4',
  'focus-visible:bg-surface3 has-focus-visible:bg-surface3',
  'data-featured:bg-surface3 has-data-featured:bg-surface3 has-data-selected:bg-surface3',
  'data-featured:hover:bg-surface4 has-data-featured:hover:bg-surface4 has-data-selected:hover:bg-surface4',
  'data-[variant=error]:bg-notice-destructive/10 has-data-[variant=error]:bg-notice-destructive/10',
] as const;

export const dataListRowInteractiveStyles = [
  'data-list-row-target grid grid-cols-subgrid gap-4 px-3 cursor-pointer',
] as const;

export const dataListRowStyles = [
  ...dataListRowInteractiveStyles,
  ...dataListRowOuterStyles,
  ...dataListRowStateStyles,
] as const;

export const dataListRowStaticStyles = ['grid grid-cols-subgrid gap-4 px-3', ...dataListRowOuterStyles] as const;

export const dataListRowActionRevealStyles =
  'opacity-0 pointer-coarse:opacity-100 group-focus-within/data-list-row:opacity-100 group-hover/data-list-row:opacity-100';

export type DataListSticky = 'start';

export const dataListStickyStartStyles = [
  'data-list-sticky-start sticky left-0 z-10 isolate self-stretch overflow-visible',
] as const;

export type DataListRowVariant = 'default' | 'error';

export type DataListRowSharedProps = {
  variant?: DataListRowVariant;
  colStart?: number;
  colEnd?: number;
  featured?: boolean;
};

export function splitColumns(columns: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of columns) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (/\s/.test(char) && depth === 0) {
      if (current) parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts;
}
