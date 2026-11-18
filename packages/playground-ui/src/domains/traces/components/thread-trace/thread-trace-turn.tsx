import type { ReactNode } from 'react';

import { TraceThreadItemView } from '../trace-thread-item-view';
import type { TraceThreadItemViewProps } from '../trace-thread-item-view';
import { ThreadTraceTab } from './thread-trace-messages';
import type { ThreadTraceTabProps } from './thread-trace-messages';
import { useThreadTraceRow } from './thread-trace-row-context';
import { Button } from '@/ds/components/Button';
import { IconChatBubble7 } from '@/ds/icons/central/IconChatBubble7';
import { IconChatBubble7Plus } from '@/ds/icons/central/IconChatBubble7Plus';
import { IconSquareArrowTopRight } from '@/ds/icons/central/IconSquareArrowTopRight';
import { Icon } from '@/ds/icons/Icon';
import { ScorersIcon } from '@/ds/icons/ScorersIcon';
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

export type ThreadTracePresetTabProps = Omit<ThreadTraceTabProps, 'value' | 'children'>;

/** The tab of the row's reconstructed messages (`value="messages"`). */
export function ThreadTraceMessagesTab(props: ThreadTracePresetTabProps) {
  return (
    <ThreadTraceTab value="messages" {...props}>
      <Icon size="xs">
        <IconChatBubble7 />
      </Icon>
      Messages
    </ThreadTraceTab>
  );
}

/** The tab of the row's feedback (`value="feedback"`). */
export function ThreadTraceFeedbackTab(props: ThreadTracePresetTabProps) {
  return (
    <ThreadTraceTab value="feedback" {...props}>
      <Icon size="xs">
        <IconChatBubble7Plus />
      </Icon>
      Feedback
    </ThreadTraceTab>
  );
}

/** The tab of the row's scores (`value="scores"`). */
export function ThreadTraceScoresTab(props: ThreadTracePresetTabProps) {
  return (
    <ThreadTraceTab value="scores" {...props}>
      <Icon size="xs">
        <ScorersIcon />
      </Icon>
      Scores
    </ThreadTraceTab>
  );
}
