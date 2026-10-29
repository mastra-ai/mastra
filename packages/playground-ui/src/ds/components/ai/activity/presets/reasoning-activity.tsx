import { Brain } from 'lucide-react';
import { ActivityItem } from '../activity';
import { ReasoningText } from './reasoning-text';
import { hasReasoningText, hasVisibleReasoning } from './reasoning-visibility';
import type { ReasoningContent } from './reasoning-visibility';

export interface ReasoningActivityProps extends ReasoningContent {
  defaultOpen?: boolean;
}

export function ReasoningActivity({ defaultOpen = true, ...content }: ReasoningActivityProps) {
  if (!hasVisibleReasoning(content)) return null;

  return (
    <ActivityItem
      icon={<Brain aria-hidden />}
      label="Reasoning"
      status={content.streaming ? 'running' : 'idle'}
      defaultOpen={defaultOpen}
      aria-label="Reasoning"
    >
      {hasReasoningText(content) && (
        <ReasoningText content={content} className="text-caption text-muted-foreground [&_p]:my-0.5" />
      )}
    </ActivityItem>
  );
}
