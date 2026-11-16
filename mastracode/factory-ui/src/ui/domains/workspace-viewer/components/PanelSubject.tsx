import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

export function PanelSubject({
  lead,
  icon,
  title,
  loading = false,
}: {
  lead: ReactNode | undefined;
  icon?: ReactNode;
  title?: string;
  loading?: boolean;
}) {
  const slotted = Boolean(icon || lead);
  return (
    <div className={cn('flex h-control-sm min-w-0 flex-1 items-center gap-1', !slotted && 'ps-2')}>
      {slotted ? (
        <span className="h-control-sm min-w-control-sm grid shrink-0 place-items-center *:col-start-1 *:row-start-1">
          {icon ? <span className={cn('flex items-center', lead && 'invisible')}>{icon}</span> : null}
          {lead}
        </span>
      ) : null}
      {loading ? (
        <span role="status" aria-label="Loading title" className="h-control-sm flex min-w-0 flex-1 items-center">
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
