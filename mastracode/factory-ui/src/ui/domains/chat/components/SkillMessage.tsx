import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { BookOpen } from 'lucide-react';
import { useState } from 'react';

import { Markdown } from '../../../ui/Markdown';

import { ROW_RAIL, ROW_TRIGGER, TranscriptRow } from './TranscriptRow';

import type { SkillActivation } from './skill-activation';

export type { SkillActivation } from './skill-activation';
export { parseSkillActivation } from './skill-activation';

export function SkillMessage({ activation }: { activation: SkillActivation }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="max-w-full min-w-0"
      data-skill-name={activation.name}
      role="group"
      aria-label={`Skill: ${activation.name}`}
    >
      <CollapsibleTrigger className={ROW_TRIGGER}>
        <TranscriptRow
          icon={<BookOpen size={14} strokeWidth={1.75} aria-hidden className="text-accent3" />}
          label="Skill"
          detail={activation.arguments ? `${activation.name} ${activation.arguments}` : activation.name}
          expanded={expanded}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="max-w-full min-w-0">
        <div className={ROW_RAIL}>
          <ScrollArea maxHeight="24rem" revealScrollbarOnHover={false}>
            <div className="prose text-ui-sm">
              <Markdown>{activation.instructions}</Markdown>
            </div>
          </ScrollArea>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
