import type { ReactNode, Ref } from 'react';

export interface DataPanelContentProps {
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

export function DataPanelContent({ children, ref }: DataPanelContentProps) {
  return (
    <div ref={ref} className="flex-1 overflow-y-auto p-4">
      {children}
    </div>
  );
}
