import { Brain } from 'lucide-react';
import { ActivityItem } from '../activity';
import { hasVisibleReasoning } from './reasoning-visibility';
import type { ReasoningContent } from './reasoning-visibility';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';

export interface ReasoningActivityProps extends ReasoningContent {
  defaultOpen?: boolean;
}

export function ReasoningActivity({ defaultOpen = true, ...content }: ReasoningActivityProps) {
  if (!hasVisibleReasoning(content)) return null;

  const { text, redacted, streaming } = content;
  const body = redacted ? 'Reasoning was redacted by the provider.' : text;

  return (
    <ActivityItem
      icon={<Brain aria-hidden />}
      label="Reasoning"
      status={streaming ? 'running' : 'idle'}
      defaultOpen={defaultOpen}
      aria-label="Reasoning"
    >
      {body.trim().length > 0 && (
        <MarkdownRenderer
          className="text-caption text-muted-foreground [&_p]:my-0.5"
          streaming={streaming && !redacted}
        >
          {body}
        </MarkdownRenderer>
      )}
    </ActivityItem>
  );
}
