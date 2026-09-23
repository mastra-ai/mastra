import type { ReactNode } from 'react';

import { ArrivalScope, useWatched } from '@/ds/components/Arrival';

import './comment-arrival.css';

/** A comment the reader watched land rises into place; one that was already there just appears. */
export function CommentArrival({ children }: { children: ReactNode }) {
  const watched = useWatched();

  return (
    <div data-slot="comment-arrival" className={watched ? 'mastra-comment-arriving' : undefined}>
      <ArrivalScope>{children}</ArrivalScope>
    </div>
  );
}
