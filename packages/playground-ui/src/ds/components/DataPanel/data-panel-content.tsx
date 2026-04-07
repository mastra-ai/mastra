import type { ReactNode, Ref } from 'react';

export interface DataPanelContentProps {
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

export function DataPanelContent({ children, ref }: DataPanelContentProps) {
  return (
    <div ref={ref} className="flex-1 p-4 overflow-y-auto">
      {children}
    </div>
  );
}
