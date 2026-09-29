import { ActivityItem } from '@mastra/playground-ui/components/ai/activity';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { BookOpen } from 'lucide-react';
import type { SkillActivation } from './skill-activation';

export type { SkillActivation } from './skill-activation';
export { parseSkillActivation } from './skill-activation';

export function SkillMessage({ activation }: { activation: SkillActivation }) {
  const { name, arguments: args, instructions } = activation;
  return (
    <ActivityItem
      label="Skill"
      detail={args ? `${name} ${args}` : name}
      icon={<BookOpen className="text-span-skill" aria-hidden />}
      data-skill-name={name}
      aria-label={`Skill: ${name}`}
    >
      <ScrollArea maxHeight="24rem" revealScrollbarOnHover={false}>
        <MarkdownRenderer className="text-caption">{instructions}</MarkdownRenderer>
      </ScrollArea>
    </ActivityItem>
  );
}
