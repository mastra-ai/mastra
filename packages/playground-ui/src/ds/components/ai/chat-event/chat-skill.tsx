import { BookOpen } from 'lucide-react';
import { ChatEvent } from './chat-event';
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
    <ChatEvent
      label="Skill"
      detail={args ? `${name} ${args}` : name}
      icon={<BookOpen size={14} strokeWidth={1.75} aria-hidden className="text-accent3" />}
      data-skill-name={name}
      aria-label={`Skill: ${name}`}
      defaultOpen={defaultOpen}
    >
      <ScrollArea maxHeight="24rem" revealScrollbarOnHover={false}>
        <MarkdownRenderer className="text-ui-sm">{instructions}</MarkdownRenderer>
      </ScrollArea>
    </ChatEvent>
  );
}
