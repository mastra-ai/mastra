import { Skeleton } from '@mastra/playground-ui/components/Skeleton';

import { OM_FLOW, OM_ROWS, OMRow } from './OMRow';

const CONTROL = 'h-control-sm w-full motion-reduce:before:animate-none';

export function OMSectionSkeleton() {
  return (
    <div role="status" aria-label="Loading observational-memory settings">
      <div inert className={OM_FLOW}>
        <ol className="flex flex-col">
          <OMRow as="li" {...OM_ROWS.messages} />
          <OMRow as="li" {...OM_ROWS.observeAfter}>
            <Skeleton className={CONTROL} />
          </OMRow>
          <OMRow as="li" {...OM_ROWS.observer}>
            <Skeleton className={CONTROL} />
          </OMRow>
          <OMRow as="li" {...OM_ROWS.reflectAfter}>
            <Skeleton className={CONTROL} />
          </OMRow>
          <OMRow as="li" {...OM_ROWS.reflector}>
            <Skeleton className={CONTROL} />
          </OMRow>
        </ol>
        <OMRow {...OM_ROWS.attachments}>
          <Skeleton className="h-control-sm w-40 motion-reduce:before:animate-none" />
        </OMRow>
      </div>
    </div>
  );
}
