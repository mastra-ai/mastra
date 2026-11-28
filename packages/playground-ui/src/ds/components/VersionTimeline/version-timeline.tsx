import type { ComponentProps, ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export type VersionState = 'unsaved' | 'draft' | 'live' | 'past';

const DOT: Record<VersionState, string> = {
  unsaved: 'border border-muted-foreground bg-card',
  draft: 'bg-info-indicator',
  live: 'bg-success-indicator',
  past: 'bg-muted-foreground',
};

export type VersionTimelineProps = Omit<ComponentProps<'ol'>, 'children'> & { children: ReactNode };

export function VersionTimelineRoot({ className, ...props }: VersionTimelineProps) {
  return <ol className={cn('flex flex-col', className)} {...props} />;
}

export interface VersionTimelineItemProps {
  state: VersionState;
  title: ReactNode;
  label?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  selected?: boolean;
  children?: ReactNode;
}

export function VersionTimelineItem({
  state,
  title,
  label,
  meta,
  actions,
  selected,
  children,
}: VersionTimelineItemProps) {
  return (
    <li className="group/version flex gap-3" aria-current={selected || undefined}>
      <span className="flex w-2 shrink-0 flex-col items-center" aria-hidden="true">
        <span className={cn('mt-2 size-2 shrink-0 rounded-full', DOT[state])} />
        <span className="mt-1 w-px flex-1 bg-border group-last/version:hidden" />
      </span>
      <div
        className={cn(
          'mb-1 flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg px-2 py-1 group-hover/version:bg-fill-subtle',
          selected && 'bg-fill-subtle',
        )}
      >
        <div className="relative flex min-h-5 items-center justify-between gap-2">
          <Txt as="span" variant="label" tone={state === 'unsaved' ? 'muted' : 'ink'} className="truncate">
            {title}
            {label ? (
              <Txt as="span" variant="caption" tone="muted" className="ml-1.5">
                {label}
              </Txt>
            ) : null}
          </Txt>
          {meta ? (
            <Txt
              as="span"
              variant="caption"
              tone="muted"
              className={cn(
                'shrink-0 tabular-nums',
                actions &&
                  'group-focus-within/version:invisible group-hover/version:invisible pointer-coarse:invisible',
              )}
            >
              {meta}
            </Txt>
          ) : null}
          {actions ? (
            <span className="absolute -right-1.5 flex items-center opacity-0 group-focus-within/version:opacity-100 group-hover/version:opacity-100 pointer-coarse:opacity-100">
              {actions}
            </span>
          ) : null}
        </div>
        {children}
      </div>
    </li>
  );
}

export function VersionTimelineDetail({ children }: { children: ReactNode }) {
  return (
    <Txt as="span" variant="caption" tone="muted" className="truncate">
      {children}
    </Txt>
  );
}
