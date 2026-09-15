import type { ReactNode } from 'react';

export interface DataDetailsPanelContentProps {
  children: ReactNode;
}

export function DataDetailsPanelContent({ children }: DataDetailsPanelContentProps) {
  return <div className="flex-1 overflow-y-auto p-4">{children}</div>;
}
