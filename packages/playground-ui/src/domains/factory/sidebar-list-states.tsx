import type { ReactNode } from 'react';
import { SkeletonRows } from './board/skeleton-rows';
import { Button } from '@/ds/components/Button';
import { Sidebar } from '@/ds/components/Sidebar';
import { Skeleton, SkeletonText } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';
import { IconArrowRotateCounterClockwise } from '@/ds/icons/central/IconArrowRotateCounterClockwise';

export function SidebarNavigationSkeleton({
  label,
  rows = 3,
  description = false,
}: {
  label: string;
  rows?: number;
  description?: boolean;
}) {
  return (
    <SkeletonRows label={label} rows={rows} className="gap-px">
      <Sidebar.NavList aria-hidden className="pointer-events-none">
        <Sidebar.NavLink
          render={
            <div>
              <span className="flex h-lh shrink-0 items-center">
                <Skeleton className="size-4 shrink-0 motion-reduce:before:animate-none" />
              </span>
              <Sidebar.NavLabel
                description={
                  description && (
                    <SkeletonText line="text-meta" className="h-2.5 w-20 motion-reduce:before:animate-none" />
                  )
                }
              >
                <SkeletonText line="text-label" className="h-3 w-3/4 max-w-40 motion-reduce:before:animate-none" />
              </Sidebar.NavLabel>
            </div>
          }
        />
      </Sidebar.NavList>
    </SkeletonRows>
  );
}

/**
 * A sidebar list that failed to load. Retry, offered when there is an `onRetry`, is an icon, like the section
 * header's actions above it, so the message keeps the narrow sidebar's width.
 */
export function SidebarLoadError({
  children,
  onRetry,
  retrying,
  announce = true,
}: {
  children: ReactNode;
  onRetry?: () => void;
  /** The retry is in flight; the action waits for it instead of stacking requests. */
  retrying?: boolean;
  /** Read the failure out as an alert. Off for a list that has always failed quietly. */
  announce?: boolean;
}) {
  return (
    <div role={announce ? 'alert' : undefined} className="flex min-w-0 items-center justify-between gap-2 py-0.5 pl-3">
      <Txt as="p" variant="label" className="m-0 min-w-0 truncate text-destructive-foreground">
        {children}
      </Txt>
      {onRetry && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Retry"
          tooltip="Retry"
          className="shrink-0"
          disabled={retrying}
          onClick={onRetry}
        >
          <IconArrowRotateCounterClockwise aria-hidden />
        </Button>
      )}
    </div>
  );
}

/** A sidebar list that loaded with nothing in it. */
export function SidebarEmptyNote({ children }: { children: ReactNode }) {
  return (
    <Txt as="p" variant="label" tone="muted" role="status" className="m-0 px-3 py-1.5">
      {children}
    </Txt>
  );
}
