import type { ReactNode } from 'react';

import { ThreadViewSkeleton } from '../thread-view-skeleton';
import type { ThreadViewSkeletonProps } from '../thread-view-skeleton';
import { TracesErrorContent } from '../traces-error-content';
import { Txt } from '@/ds/components/Txt';

/** The thread while its turns load: same geometry as the rows, so nothing reflows once they arrive. */
export function ThreadTraceLoading(props: ThreadViewSkeletonProps) {
  return <ThreadViewSkeleton {...props} />;
}

/** A thread with no traces. */
export function ThreadTraceEmpty({ children = 'No traces found for this thread.' }: { children?: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <Txt variant="body" tone="muted">
        {children}
      </Txt>
    </div>
  );
}

export interface ThreadTraceErrorProps {
  /** The error the host's thread request failed with. */
  error: unknown;
  title?: string;
}

/** A thread that failed to load: session expired, access denied, or the error itself. */
export function ThreadTraceError({ error, title = 'Failed to load traces' }: ThreadTraceErrorProps) {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <TracesErrorContent error={error} resource="traces" errorTitle={title} />
    </div>
  );
}
