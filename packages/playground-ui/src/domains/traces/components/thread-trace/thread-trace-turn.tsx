import type { ReactNode } from 'react';

import { TraceThreadItemView } from '../trace-thread-item-view';
import type { TraceThreadItemViewProps } from '../trace-thread-item-view';
import { useThreadTraceRow } from './thread-trace-row-context';
import { Button } from '@/ds/components/Button';
import { IconSquareArrowTopRight } from '@/ds/icons/central/IconSquareArrowTopRight';
import { useLinkComponent } from '@/lib/framework';

export type ThreadTraceTurnMessagesProps = Omit<TraceThreadItemViewProps, 'onHighlightSpans'>;

/**
 * The turn rebuilt from the row's spans (`getTrace`), through the chat UI. A message's "Highlight spans"
 * action highlights the spans behind it in this row's span tree.
 */
export function ThreadTraceTurnMessages(props: ThreadTraceTurnMessagesProps) {
  const { highlightSpans } = useThreadTraceRow();
  return <TraceThreadItemView {...props} onHighlightSpans={highlightSpans} />;
}

export interface ThreadTraceTraceLinkProps {
  /** Where the row's trace opens; defaults to the app's trace route for the row. Without one, nothing renders. */
  href?: string;
  children?: ReactNode;
}

/** A "Go to trace" link to the row's trace, set apart from the tabs that follow it. */
export function ThreadTraceTraceLink({ href, children = 'Go to trace' }: ThreadTraceTraceLinkProps) {
  const { traceId } = useThreadTraceRow();
  const { Link, paths } = useLinkComponent();
  const target = href ?? paths.traceLink(traceId);
  if (!target) return null;
  return (
    <>
      <Button render={<Link href={target} />} variant="ghost" size="sm" icon={<IconSquareArrowTopRight />}>
        {children}
      </Button>
      <span aria-hidden className="h-4 w-px bg-border" />
    </>
  );
}
