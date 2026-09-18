import { createContext, use } from 'react';

export type BreadcrumbBarSeparator = 'slash' | 'chevron';

export interface BreadcrumbBarCrumbContextValue {
  isLeaf: boolean;
  pathname?: string;
  separator: BreadcrumbBarSeparator;
}

export const BreadcrumbBarCrumbContext = createContext<BreadcrumbBarCrumbContextValue | null>(null);

export function useBreadcrumbBarCrumb() {
  return use(BreadcrumbBarCrumbContext);
}
