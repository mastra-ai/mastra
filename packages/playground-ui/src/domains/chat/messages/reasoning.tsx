import { Brain } from 'lucide-react';
import { ActivityItem } from '@/ds/components/ai/activity';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';

export interface ReasoningProps {
  text: string;
  redacted?: boolean;
  streaming?: boolean;
}

export const Reasoning = ({ text, redacted, streaming }: ReasoningProps) => {
  const body = redacted ? 'Reasoning was redacted by the provider.' : text;
  const hasBody = body.trim().length > 0;

  if (!hasBody && !streaming) return null;

  return (
    <ActivityItem
      icon={<Brain aria-hidden />}
      label="Reasoning"
      status={streaming ? 'running' : 'idle'}
      defaultOpen
      aria-label="Reasoning"
    >
      {hasBody && (
        <MarkdownRenderer
          className="text-caption text-muted-foreground [&_p]:my-0.5"
          streaming={streaming && !redacted}
        >
          {body}
        </MarkdownRenderer>
      )}
    </ActivityItem>
  );
};
