import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { ChevronRightIcon } from 'lucide-react';

import { spanSubject } from '../../lib/humanize-span-name';
import { promptMessages } from '../../lib/prompt-messages';
import type { EntryRendererProps } from './types';

/**
 * The model id, then the prompt it was given. A system prompt alone can dwarf the rest of the
 * timeline, so the messages sit behind a collapsed disclosure and only their count shows up
 * front. The turn's final answer gets its own row at the bottom, so the output is not echoed here.
 */
export function ModelGenerationEntry({ span, adornment }: EntryRendererProps) {
  const messages = promptMessages(span);
  const provider = typeof span.attributes?.provider === 'string' ? span.attributes.provider : undefined;
  const label = `Called model ${spanSubject(span)}${provider ? ` on ${provider}` : ''}`;

  if (messages.length === 0)
    return (
      <div className="flex items-center gap-2">
        <p className="text-neutral6 text-ui-smd">{label}</p>
        {adornment}
      </div>
    );

  return (
    <Collapsible>
      <div className="flex items-baseline gap-2">
        <p className="text-neutral6 text-ui-smd">{label}</p>

        <CollapsibleTrigger
          className="text-neutral3 hover:text-neutral6 duration-normal text-ui-sm flex cursor-pointer items-center gap-1 font-mono transition-colors"
          data-testid="model-prompt-messages"
        >
          <ChevronRightIcon className="size-3" />
          {messages.length} message{messages.length > 1 ? 's' : ''}
        </CollapsibleTrigger>

        {adornment}
      </div>

      <CollapsibleContent className="pt-2">
        <ul className="border-border2 flex flex-col gap-2 border-l pl-3">
          {messages.map((message, index) => (
            <li key={index} className="flex flex-col gap-0.5">
              <span className="text-neutral4 text-ui-sm font-mono uppercase">{message.role}</span>
              <span className="text-neutral6 text-ui-sm whitespace-pre-wrap">{message.text}</span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
