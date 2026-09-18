import { createContext, use } from 'react';

export type BreadcrumbSeparator = 'slash' | 'chevron';

export interface BreadcrumbItemContextValue {
  isLeaf: boolean;
  pathname?: string;
}

export const BreadcrumbItemContext = createContext<BreadcrumbItemContextValue | null>(null);
export const BreadcrumbSeparatorContext = createContext<BreadcrumbSeparator>('slash');

export function useBreadcrumbItem() {
  return use(BreadcrumbItemContext);
}

export function useBreadcrumbSeparator() {
  return use(BreadcrumbSeparatorContext);
}
