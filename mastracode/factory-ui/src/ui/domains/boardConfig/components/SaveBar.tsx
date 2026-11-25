import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

export function SaveBar({
  notices,
  status,
  children,
}: {
  notices?: ReactNode;
  status: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-card bg-card shadow-overlay dark:bg-muted sticky bottom-4 z-10 flex flex-col gap-3 p-3">
      {notices}
      <div className="flex items-center gap-3">
        <Txt variant="body-sm" tone="muted" className="min-w-0 flex-1" role="status">
          {status}
        </Txt>
        {children}
      </div>
    </div>
  );
}
