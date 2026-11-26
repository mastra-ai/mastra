import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

/** One step of a flow: a rounded cell on the panel. */
export const FLOW_CELL = 'bg-fill-subtle flex min-w-0 flex-col gap-2 rounded-2xl px-3 py-2.5';
/** The outline of the step being edited. */
export const FLOW_CELL_SELECTED = 'ring-foreground ring-1';

/** The short line joining one step of a flow to the next; a word when the steps are alternatives. */
export function Wire({ word }: { word?: string }) {
  if (word) {
    return <span className="text-caption text-muted-foreground self-center py-0.5">{word}</span>;
  }
  return <span className="bg-border-strong h-2.5 w-px shrink-0 self-center" aria-hidden />;
}

/** A labelled line of a cell, "When  [Issue opened ⌄]": the control on the right, or under the label when stacked. */
export function CellRow({ label, stacked, children }: { label: string; stacked?: boolean; children: ReactNode }) {
  return (
    <div className={cn('flex min-w-0 gap-2', stacked ? 'flex-col items-stretch' : 'items-center justify-between')}>
      <span className="text-body-sm text-muted-foreground shrink-0">{label}</span>
      <span className={cn('flex min-w-0', stacked ? 'flex-col items-stretch' : 'justify-end')}>{children}</span>
    </div>
  );
}

/** A value as the flow shows it: a small rounded chip, optionally led by an icon. */
export function ValueChip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="bg-fill text-body-sm text-foreground inline-flex h-6 max-w-full min-w-0 shrink-0 items-center gap-1.5 rounded-full px-2">
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** A picker's look where nothing can be picked: the same pill, not a button. */
export function StaticPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'bg-fill text-body-sm text-foreground inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-full px-2.5',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** "+ Condition": a dashed pill between the conditions and what comes after them. */
export function AddConditionButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Add condition"
      onClick={onClick}
      className="border-border-strong text-body-sm text-muted-foreground hover:text-foreground focus-visible:ring-foreground flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-dashed px-3 outline-hidden focus-visible:ring-1"
    >
      <IconPlusMedium className="size-icon-xs" aria-hidden />
      Condition
    </button>
  );
}
