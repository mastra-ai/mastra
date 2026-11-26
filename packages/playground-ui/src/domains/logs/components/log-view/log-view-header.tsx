import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { CopyButton } from '@/ds/components/CopyButton';
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
    >
      <IconArrowRotateClockwise className={refreshing ? 'animate-spin' : undefined} />
    </Button>
  );
}

export function LogViewActions({ children }: { children: ReactNode }) {
  return <div className="ml-auto flex items-center gap-2">{children}</div>;
}

export function LogViewCount({ count }: { count: number }) {
  return (
    <Txt as="span" variant="caption" tone="muted" className="tabular-nums">
      {count.toLocaleString()} {count === 1 ? 'line' : 'lines'}
    </Txt>
  );
}

export function LogViewCopy({ content }: { content: string }) {
  return <CopyButton content={content} tooltip="Copy logs" copyMessage="Logs copied" size="icon-sm" variant="ghost" />;
}
