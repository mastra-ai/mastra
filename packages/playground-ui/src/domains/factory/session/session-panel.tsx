import type { ReactNode } from 'react';

import { SkeletonText } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export function PanelHeading({ detail, children }: { detail?: ReactNode; children: ReactNode }) {
  return (
    <Txt as="h3" variant="meta" tone="muted" className="flex min-w-0 items-center gap-1.5 px-2 py-1">
      {children}
      {detail === undefined ? null : (
        <>
          {/* The space keeps the count its own word for screen readers: "Links 2". */}{' '}
          <Txt as="span" variant="meta" tone="faint" className="min-w-0 truncate">
            {detail}
          </Txt>
        </>
      )}
    </Txt>
  );
}

export function PanelSubject({
  lead,
  icon,
  title,
  loading = false,
}: {
  lead?: ReactNode;
  icon?: ReactNode;
  title?: string;
  loading?: boolean;
}) {
  const slotted = Boolean(icon || lead);
  return (
    <div className={cn('flex h-control-sm min-w-0 flex-1 items-center gap-1', !slotted && 'ps-2')}>
      {slotted ? (
        <span className="grid h-control-sm min-w-control-sm shrink-0 place-items-center *:col-start-1 *:row-start-1">
          {icon ? <span className={cn('flex items-center', lead && 'invisible')}>{icon}</span> : null}
          {lead}
        </span>
      ) : null}
      {loading ? (
        <span role="status" aria-label="Loading title" className="flex h-control-sm min-w-0 flex-1 items-center">
          <SkeletonText className="w-48 max-w-full motion-reduce:before:animate-none" />
        </span>
      ) : title ? (
        <Txt as="h2" variant="body-sm" tone="ink" className="min-w-0 flex-1 truncate" title={title}>
          {title}
        </Txt>
      ) : null}
    </div>
  );
}
