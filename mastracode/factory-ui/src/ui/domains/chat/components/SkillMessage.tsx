import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { BookOpen, ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { Markdown } from '../../../ui/Markdown';

import type { SkillActivation } from './skill-activation';

export type { SkillActivation } from './skill-activation';
export { parseSkillActivation } from './skill-activation';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

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
      <CollapsibleTrigger className="hover:bg-surface2 active:bg-surface4 w-full rounded-lg text-left transition-colors">
        <span className="flex w-full items-center gap-2 px-2 py-1.5">
          <ChevronDown
            size={13}
            className={cn(
              'shrink-0 text-icon3 transition-transform duration-150',
              expanded ? 'rotate-0' : '-rotate-90',
            )}
          />
          <span className="flex shrink-0 items-center">
            <BookOpen size={13} className="text-accent3" />
          </span>
          <Txt as="span" variant="ui-smd" className="text-icon5 shrink-0">
            Skill
          </Txt>
          <Txt as="span" variant="ui-sm" font="mono" className="text-icon6 shrink-0">
            {activation.name}
          </Txt>
          {activation.arguments && (
            <Txt as="span" variant="ui-xs" font="mono" className="text-icon3 truncate">
              {truncate(activation.arguments, 72)}
            </Txt>
          )}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="max-w-full min-w-0">
        <div className="border-border1 bg-surface2 mt-1 max-h-96 max-w-full min-w-0 overflow-y-auto rounded-2xl border p-2">
          <div className="prose text-ui-sm">
            <Markdown>{activation.instructions}</Markdown>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
