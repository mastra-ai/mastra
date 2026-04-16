import type { ReactNode } from 'react';

export interface DataDetailsPanelContentProps {
  children: ReactNode;
}

export function DataDetailsPanelContent({ children }: DataDetailsPanelContentProps) {
  return <div className="flex-1 p-4 overflow-y-auto">{children}</div>;
}
