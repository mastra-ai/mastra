import type { ComponentProps } from 'react';

export type ThreadTraceLoadMoreSentinelProps = ComponentProps<'div'>;

/**
 * Pages load older traces and the list reads oldest-first, so the sentinel sits at the top of the
 * list. Pass the infinite-scroll `ref` here; scroll anchoring keeps the viewport in place when a
 * page is prepended.
 */
export function ThreadTraceLoadMoreSentinel(props: ThreadTraceLoadMoreSentinelProps) {
  return <div data-slot="thread-trace-load-more-sentinel" {...props} />;
}
