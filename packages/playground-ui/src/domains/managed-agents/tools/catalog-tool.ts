import type { ReactNode } from 'react';

export interface CatalogTool {
  id: string;
  name: string;
  description: string;
  logo: ReactNode;
  connected: boolean;
}
