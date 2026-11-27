import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { Skeleton } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';

export interface DocumentEditorDetailsProps {
  onClose?: () => void;
  isLoading?: boolean;
  children?: ReactNode;
}

export function DocumentEditorDetails({ onClose, isLoading, children }: DocumentEditorDetailsProps) {
  return (
    <aside
      aria-label="Details"
      aria-busy={isLoading || undefined}
      className="flex w-75 shrink-0 flex-col self-start overflow-hidden rounded-card bg-card shadow-[inset_0_0_0_1px_var(--surface-rim)]"
    >
      <div className="flex min-h-10 items-center justify-between border-b border-surface-rim pr-2 pl-4">
        <Txt as="h2" variant="label" tone="ink">
          Details
        </Txt>
        {onClose ? (
          <Button variant="ghost" size="icon-sm" aria-label="Hide details" onClick={onClose}>
            <IconCrossMedium />
          </Button>
        ) : null}
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-3 p-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : (
        children
      )}
    </aside>
  );
}
