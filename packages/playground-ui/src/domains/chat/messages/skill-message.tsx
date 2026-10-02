import { BookOpen } from 'lucide-react';

import type { SkillActivation } from './skill-activation';
import { ActivityItem, SignalActivity } from '@/ds/components/ai/activity';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { ScrollArea } from '@/ds/components/ScrollArea';

export function SkillMessage({ activation }: { activation: SkillActivation }) {
  const { name, arguments: args, instructions, feed } = activation;
  const item = (
    <ActivityItem
      label="Skill"
      detail={args ? `${name} ${args}` : name}
      icon={<BookOpen className="text-span-skill" aria-hidden />}
      data-skill-name={name}
      aria-label={`Skill: ${name}`}
    >
      <ScrollArea maxHeight="24rem" revealScrollbarOnHover={false}>
        <MarkdownRenderer variant="caption">{instructions}</MarkdownRenderer>
      </ScrollArea>
    </ActivityItem>
  );

  if (feed === undefined) return item;

  return (
    <div className="flex flex-col">
      {item}
      <SignalActivity kind="reactive" label="Work item feed" message={feed} />
    </div>
  );
}
