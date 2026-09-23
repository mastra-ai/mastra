import { BookOpen } from 'lucide-react';
import { ActivityItem } from '@/ds/components/ai/activity';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { ScrollArea } from '@/ds/components/ScrollArea';

export interface ChatSkillProps {
  name: string;
  arguments?: string;
  instructions: string;
  defaultOpen?: boolean;
}

export function ChatSkill({ name, arguments: args, instructions, defaultOpen }: ChatSkillProps) {
  return (
    <ActivityItem
      label="Skill"
      detail={args ? `${name} ${args}` : name}
      icon={<BookOpen className="text-accent3" aria-hidden />}
      data-skill-name={name}
      aria-label={`Skill: ${name}`}
      defaultOpen={defaultOpen}
    >
      <ScrollArea maxHeight="24rem" revealScrollbarOnHover={false}>
        <MarkdownRenderer className="text-caption">{instructions}</MarkdownRenderer>
      </ScrollArea>
    </ActivityItem>
  );
}
