import { createContext } from 'react';
import type { ComponentType, ReactNode } from 'react';

export interface PageLayoutHeaderProps {
  breadcrumbs?: ReactNode;
  headerActions?: ReactNode;
  /** Essential controls that stay visible beside breadcrumbs on compact layouts. */
  primaryActions?: ReactNode;
}

/** Lets an application compose page navigation into its shared responsive chrome. */
export const PageLayoutHeaderContext = createContext<ComponentType<PageLayoutHeaderProps> | undefined>(undefined);
