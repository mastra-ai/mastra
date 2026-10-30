import type { ReasoningContent } from '@/ds/components/ai/activity';
import { ReasoningText } from '@/ds/components/ai/activity';

/** A thought in an open stretch, read like the answer around it. */
export function StretchThought({ content }: { content: ReasoningContent }) {
  return <ReasoningText content={content} className="text-muted-foreground" />;
}
