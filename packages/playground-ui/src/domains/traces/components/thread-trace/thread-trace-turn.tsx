import type { ReactNode } from 'react';

import { useTraceNavigation } from '../trace-navigation';
import { TraceThreadItemView } from '../trace-thread-item-view';
import type { TraceThreadItemViewProps } from '../trace-thread-item-view';
import { useThreadTraceRow } from './thread-trace-row-context';
import { Button } from '@/ds/components/Button';
import { IconSquareArrowTopRight } from '@/ds/icons/central/IconSquareArrowTopRight';

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
  children?: ReactNode;
}

/**
 * "Go to trace": opens the row's trace through the root's `navigation.onOpenTrace`, set apart from the
 * tabs that follow it. Renders nothing when the host does not open traces.
 */
export function ThreadTraceTraceLink({ children = 'Go to trace' }: ThreadTraceTraceLinkProps) {
  const { traceId } = useThreadTraceRow();
  const { onOpenTrace } = useTraceNavigation();
  if (!onOpenTrace) return null;
  return (
    <>
      <Button onClick={() => onOpenTrace(traceId)} variant="ghost" size="sm" icon={<IconSquareArrowTopRight />}>
        {children}
      </Button>
      <span aria-hidden className="h-4 w-px bg-border" />
    </>
  );
}
