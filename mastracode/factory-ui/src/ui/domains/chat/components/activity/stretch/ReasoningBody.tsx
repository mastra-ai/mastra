import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import type { ReasoningContent } from '@mastra/playground-ui/components/ai/activity';

export function reasoningHasBody({ text, redacted }: ReasoningContent): boolean {
  return Boolean(redacted) || text.trim().length > 0;
}

export function ReasoningBody({ content: { text, redacted, streaming } }: { content: ReasoningContent }) {
  return (
    <MarkdownRenderer className="text-muted-foreground" streaming={streaming && !redacted}>
      {redacted ? 'Reasoning was redacted by the provider.' : text}
    </MarkdownRenderer>
  );
}
