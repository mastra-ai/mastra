import { CodeBlock } from '@mastra/playground-ui/components/CodeBlock';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { ChevronRightIcon } from 'lucide-react';
import { Fragment } from 'react';

import type { TimelineSpan } from '../lib/build-thread-timeline';
import { spanPayloadEntries, spanPayloadSections } from '../lib/span-payloads';

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

  // A processor's output is a handful of first-level keys, so a flat readout says more
  // than a JSON dump. Anything else — a bare string, say — still needs the code block.
  const entries = span.spanType === 'processor_run' ? spanPayloadEntries(span.output) : [];

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

            {entries.length > 0 ? (
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1" data-testid="span-payload-entries">
                {entries.map(entry => (
                  <Fragment key={entry.key}>
                    <span className="text-neutral3 text-ui-sm font-mono">{entry.key}</span>
                    <span className="text-ui-sm break-all">{entry.value}</span>
                  </Fragment>
                ))}
              </div>
            ) : (
              <CodeBlock code={section.json} lang={section.highlight ? 'json' : undefined} overflow="scroll" />
            )}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
