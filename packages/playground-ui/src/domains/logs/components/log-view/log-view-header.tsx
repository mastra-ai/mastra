import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { IconArrowRotateClockwise } from '@/ds/icons/central/IconArrowRotateClockwise';

export function LogViewHeader({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 px-4 py-2">{children}</div>;
}

export function LogViewTitle({ children = 'Logs' }: { children?: ReactNode }) {
  return (
    <Txt as="h3" variant="label" className="mr-1">
      {children}
    </Txt>
  );
}

export interface LogViewRefreshProps {
  onRefresh: () => void;
  refreshing?: boolean;
}

export function LogViewRefresh({ onRefresh, refreshing }: LogViewRefreshProps) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      onClick={onRefresh}
      disabled={refreshing}
      aria-label="Refresh logs"
      className="ml-auto"
    >
      <IconArrowRotateClockwise className={refreshing ? 'animate-spin' : undefined} />
    </Button>
  );
}
