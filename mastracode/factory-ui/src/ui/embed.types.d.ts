/** Public types for the `./embed` export, so hosts don't type-check Factory's sources under their own config. */
import type { ReactNode } from 'react';

export interface FactoryEmbedProviderProps {
  root: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
  sidebarContainer: HTMLElement | null;
  children: ReactNode;
}

export type FactoryEmbedAppProps = Omit<FactoryEmbedProviderProps, 'children'>;

export declare function FactoryEmbedProvider(props: FactoryEmbedProviderProps): ReactNode;
export declare function FactoryEmbedApp(props: FactoryEmbedAppProps): ReactNode;
