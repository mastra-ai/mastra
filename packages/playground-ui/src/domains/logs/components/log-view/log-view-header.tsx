import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { CardContent } from '@/ds/components/Card';
import { Txt } from '@/ds/components/Txt';
import { IconArrowRotateClockwise } from '@/ds/icons/central/IconArrowRotateClockwise';

export function LogViewHeader({ children }: { children: ReactNode }) {
  return (
    <CardContent density="compact" className="flex flex-wrap items-center gap-2">
      {children}
    </CardContent>
  );
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
