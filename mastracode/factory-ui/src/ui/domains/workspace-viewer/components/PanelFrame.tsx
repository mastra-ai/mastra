import type { ReactNode } from 'react';

export function PanelFrame({ subject, children }: { subject: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-0 w-full min-w-0 grow flex-col overflow-hidden">
      <div className="flex shrink-0 py-1.5 ps-1.5 pe-[calc(0.375rem+var(--dock-actions-reserve,0px))]">{subject}</div>
      {children}
    </div>
  );
}
