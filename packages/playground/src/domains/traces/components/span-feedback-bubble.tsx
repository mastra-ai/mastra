import { Button } from '@mastra/playground-ui/components/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { MessageCircle } from 'lucide-react';

import { SpanFeedbackTab } from './span-feedback-tab';

type SpanFeedbackBubbleProps = {
  traceId: string;
  spanId: string;
  count?: number;
};

/**
 * Comment affordance on a timeline row. The thread only queries once the popover
 * opens, since `PopoverContent` is unmounted while closed.
 */
export function SpanFeedbackBubble({ traceId, spanId, count = 0 }: SpanFeedbackBubbleProps) {
  const label = count > 0 ? `Comments on this step (${count})` : 'Add a comment on this step';

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            size={count > 0 ? 'sm' : 'icon-xs'}
            variant="ghost"
            aria-label={label}
            className={
              count > 0
                ? 'text-neutral5 cursor-pointer'
                : 'text-neutral4 cursor-pointer opacity-0 transition-opacity group-focus-within/timeline-row:opacity-100 group-hover/timeline-row:opacity-100 focus-visible:opacity-100'
            }
          >
            <MessageCircle />
            {count > 0 ? count : null}
          </Button>
        }
      />
      <PopoverContent side="left" align="start" className="w-96 p-3">
        {/* The popover already is the card, so drop the embed variant's own surface. */}
        <SpanFeedbackTab traceId={traceId} spanId={spanId} variant="embed" className="border-0 bg-transparent p-0" />
      </PopoverContent>
    </Popover>
  );
}
