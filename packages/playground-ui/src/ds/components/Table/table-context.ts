import { createContext, use } from 'react';

export type TableVariant = 'default' | 'inset';

export const TableVariantContext = createContext<TableVariant>('default');

export function useTableVariant() {
  return use(TableVariantContext);
}

export function insetSlot(variant: TableVariant, slot: string) {
  if (variant === 'inset') return slot;
  return undefined;
}
