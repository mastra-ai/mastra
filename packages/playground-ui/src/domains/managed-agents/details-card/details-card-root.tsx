import type { ReactNode } from 'react';
import { CHAT_LAYOUT_SHORTCUTS } from '../chat-layout/chat-layout-types';
import { Button } from '@/ds/components/Button';
import { ShortcutHint } from '@/ds/components/Kbd/shortcut-hint';
import { Skeleton } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';

export interface DetailsCardProps {
  onClose?: () => void;
  isLoading?: boolean;
  children?: ReactNode;
}

export function DetailsCardRoot({ onClose, isLoading, children }: DetailsCardProps) {
  return (
    <aside
      aria-label="Details"
      aria-busy={isLoading || undefined}
      className="flex w-75 shrink-0 flex-col self-start overflow-hidden rounded-card bg-card shadow-[inset_0_0_0_1px_var(--surface-rim)] [[role=dialog]_&]:w-full [[role=dialog]_&]:rounded-none [[role=dialog]_&]:bg-transparent [[role=dialog]_&]:shadow-none"
    >
      <div className="flex min-h-10 items-center justify-between border-b border-surface-rim pr-2 pl-4">
        <Txt as="h2" variant="label" tone="ink">
          Details
        </Txt>
        {onClose ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Hide details"
            tooltip={<ShortcutHint label="Hide details" shortcut={CHAT_LAYOUT_SHORTCUTS.details} />}
            onClick={onClose}
          >
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
