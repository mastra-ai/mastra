import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Slash } from 'lucide-react';
import { useState } from 'react';

import { ROW_RAIL, ROW_TRIGGER, TranscriptRow } from './TranscriptRow';

import type { SlashCommandActivation } from './skill-activation';

export type { SlashCommandActivation } from './skill-activation';

/** Compact expandable row for an executed custom slash command. */
export function SlashCommandMessage({ activation }: { activation: SlashCommandActivation }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="max-w-full min-w-0"
      data-slash-command-name={activation.name}
      role="group"
      aria-label={`Slash command: ${activation.name}`}
    >
      <CollapsibleTrigger className={ROW_TRIGGER}>
        <TranscriptRow
          icon={<Slash size={14} strokeWidth={1.75} aria-hidden className="text-accent3" />}
          label="Command"
          detail={activation.name}
          expanded={expanded}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="max-w-full min-w-0">
        <div className={ROW_RAIL}>
          <ScrollArea maxHeight="24rem" revealScrollbarOnHover={false}>
            <MarkdownRenderer className="text-ui-sm">{activation.content}</MarkdownRenderer>
          </ScrollArea>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
