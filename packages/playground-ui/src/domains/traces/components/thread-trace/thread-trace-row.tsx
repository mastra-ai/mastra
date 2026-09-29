import { useCallback, useMemo } from 'react';
import type { ComponentProps } from 'react';

import { useThreadTrace } from './thread-trace-context';
import { ThreadTraceRowContext } from './thread-trace-row-context';
import type { ThreadTraceRowContextValue } from './thread-trace-row-context';
import { cn } from '@/lib/utils';

export interface ThreadTraceRowProps extends ComponentProps<'div'> {
  traceId: string;
}

// Module-level so the callback ref keeps its identity and React only invokes it on mount/unmount.
const scrollIntoViewOnMount = (row: HTMLDivElement | null) => {
  row?.scrollIntoView({ block: 'start' });
};

/**
 * One agent turn of the conversation. The row is dimmed unless it is the first one in view,
 * hovered, or its trace is open, so the reader keeps track of which turn they are on.
 */
export function ThreadTraceRow({ traceId, className, children, ...props }: ThreadTraceRowProps) {
  const root = useThreadTrace();

  const turn = root.traceIds.indexOf(traceId) + 1;
  const isActive = root.openTraceId === traceId;
  const isCurrent = root.currentTraceId === traceId;
  const isAnchor = root.anchorTraceId === traceId;

  const { highlightSpans: rootHighlightSpans, toggleTrace: rootToggleTrace } = root;
  const highlightSpans = useCallback(
    (spanIds: string[]) => rootHighlightSpans(traceId, spanIds),
    [rootHighlightSpans, traceId],
  );
  const toggleTrace = useCallback(() => rootToggleTrace(traceId), [rootToggleTrace, traceId]);

  const contextValue = useMemo<ThreadTraceRowContextValue>(
    () => ({ traceId, turn, isActive, isCurrent, isAnchor, highlightSpans, toggleTrace }),
    [traceId, turn, isActive, isCurrent, isAnchor, highlightSpans, toggleTrace],
  );

  return (
    <ThreadTraceRowContext.Provider value={contextValue}>
      <div
        data-slot="thread-trace-row"
        className={cn(
          'group flex flex-col pr-4 pl-14 transition-opacity hover:opacity-100',
          isActive || isCurrent ? 'opacity-100' : 'opacity-50',
          className,
        )}
        data-trace-id={traceId}
        data-active={isActive || undefined}
        ref={isAnchor ? scrollIntoViewOnMount : undefined}
        {...props}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col">{children}</div>
      </div>
    </ThreadTraceRowContext.Provider>
  );
}
