import type { ReasoningContent } from './reasoning-visibility';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';

export interface ReasoningTextProps {
  content: ReasoningContent;
  className?: string;
}

export function ReasoningText({ content: { text, redacted, streaming }, className }: ReasoningTextProps) {
  return (
    <MarkdownRenderer className={className} streaming={streaming && !redacted}>
      {redacted ? 'Reasoning was redacted by the provider.' : text}
    </MarkdownRenderer>
  );
}
