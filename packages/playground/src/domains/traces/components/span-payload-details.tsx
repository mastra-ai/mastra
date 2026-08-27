import { CodeBlock } from '@mastra/playground-ui/components/CodeBlock';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { ChevronRightIcon } from 'lucide-react';

import type { TimelineSpan } from '../lib/build-thread-timeline';
import { spanPayloadSections } from '../lib/span-payloads';

export type SpanPayloadDetailsProps = {
  span: TimelineSpan;
};

/**
 * Escape hatch under a timeline row: the raw payloads the prose above summarises or omits.
 * Collapsed by default, and Base UI unmounts the panel while closed, so the cost of these
 * blocks — including highlighting a large toolset — is only paid on the rows actually opened.
 */
export function SpanPayloadDetails({ span }: SpanPayloadDetailsProps) {
  const sections = spanPayloadSections(span);
  if (sections.length === 0) return null;

  return (
    <Collapsible>
      <CollapsibleTrigger
        className="text-neutral3 hover:text-neutral6 duration-normal text-ui-sm flex cursor-pointer items-center gap-1 font-mono transition-colors"
        data-testid="span-payload-details"
      >
        <ChevronRightIcon className="size-3" />
        Details
      </CollapsibleTrigger>

      <CollapsibleContent className="flex flex-col gap-2 pt-2">
        {sections.map(section => (
          <div key={section.label} className="flex flex-col gap-1">
            <span className="text-neutral3 text-ui-sm font-mono uppercase">{section.label}</span>

            <CodeBlock code={section.json} lang={section.highlight ? 'json' : undefined} overflow="scroll" />
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
