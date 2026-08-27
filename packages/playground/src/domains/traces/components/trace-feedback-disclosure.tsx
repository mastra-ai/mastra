import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { ChevronRightIcon } from 'lucide-react';

import { useTraceFeedback } from '../hooks/use-trace-feedback';
import { TraceFeedbackTab } from './trace-feedback-tab';

type TraceFeedbackDisclosureProps = {
  traceId: string;
};

/**
 * Trace-level feedback, folded away behind its own count. A turn is read before it is judged, and
 * an open composer at the end of every trace made the page look busier than the conversation is.
 *
 * The count comes from the same query key the thread inside uses, so opening the disclosure costs
 * no extra request.
 */
export function TraceFeedbackDisclosure({ traceId }: TraceFeedbackDisclosureProps) {
  const { data } = useTraceFeedback({ traceId });
  const count = data?.feedback?.length ?? 0;
  // A page holds ten records, so past that the label states what it knows rather than guessing.
  const total = data?.pagination?.hasMore ? `${count}+` : `${count}`;
  const label = count > 0 ? `${total} feedback${count > 1 ? 's' : ''} on this turn` : 'Add feedback to this turn';

  return (
    <Collapsible>
      <CollapsibleTrigger
        className="text-neutral3 hover:text-neutral6 duration-normal text-ui-sm flex cursor-pointer items-center gap-1 font-mono transition-colors"
        data-testid="trace-feedback-disclosure"
      >
        <ChevronRightIcon className="size-3" />
        {label}
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-2">
        <section aria-label="Trace comments">
          <TraceFeedbackTab traceId={traceId} variant="embed" emptyLabel="Give feedback on this turn" />
        </section>
      </CollapsibleContent>
    </Collapsible>
  );
}
