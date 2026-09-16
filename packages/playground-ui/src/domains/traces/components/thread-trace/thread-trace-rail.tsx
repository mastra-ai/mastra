import { useCallback } from 'react';
import type { ComponentProps } from 'react';

import { useThreadTrace } from './thread-trace-context';
import { ThreadRail } from '@/ds/components/ThreadRail';
import type { ThreadRailTurn } from '@/ds/components/ThreadRail';
import { cn } from '@/lib/utils';

export interface ThreadTraceRailProps extends ComponentProps<'div'> {
  /** One stop per turn; `messageId` must be the trace id of the matching row. */
  turns: ThreadRailTurn[];
  railClassName?: string;
}

/** Same rail as the chat page: one stop per turn, pinned mid-height while the list scrolls. */
export function ThreadTraceRail({ turns, className, railClassName, ...props }: ThreadTraceRailProps) {
  const { currentTraceId, visibleTraceIds, scrollToTrace } = useThreadTrace();
  const onSelect = useCallback((turn: ThreadRailTurn) => scrollToTrace(turn.messageId), [scrollToTrace]);

  return (
    <div
      data-slot="thread-trace-rail"
      className={cn('pointer-events-none absolute inset-y-0 left-4 z-20', className)}
      {...props}
    >
      <ThreadRail
        turns={turns}
        currentAnchorId={currentTraceId}
        visibleMessageIds={visibleTraceIds}
        onSelect={onSelect}
        className={cn('pointer-events-auto sticky top-1/2 -translate-y-1/2', railClassName)}
      />
    </div>
  );
}
