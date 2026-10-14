import { HoverCard, HoverCardContent, HoverCardTrigger } from '@mastra/playground-ui/components/HoverCard';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { InfoIcon } from 'lucide-react';

export interface ScoreReasonHoverCardProps {
  scorerId: string;
  reason: string;
  /**
   * Render the trigger as a hover-only icon instead of a button, for use inside
   * another interactive element (e.g. a list row button) where a nested button
   * would be invalid.
   */
  nested?: boolean;
}

export function ScoreReasonHoverCard({ scorerId, reason, nested = false }: ScoreReasonHoverCardProps) {
  const iconClassName = 'text-muted-foreground hover:text-foreground [&>svg]:size-3.5';

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={0}
        closeDelay={100}
        render={
          nested ? (
            <span aria-hidden data-testid={`score-reason-${scorerId}`} className={`flex ${iconClassName}`} />
          ) : (
            <button
              type="button"
              aria-label={`Show ${scorerId} reason`}
              className={`cursor-pointer ${iconClassName}`}
            />
          )
        }
      >
        <InfoIcon />
      </HoverCardTrigger>
      {/* The card is portaled but still bubbles React events to the trigger's ancestors (e.g. a row button). */}
      <HoverCardContent
        side="left"
        align="start"
        className="max-h-80 max-w-100 overflow-y-auto"
        onClick={event => event.stopPropagation()}
      >
        <MarkdownRenderer>{reason}</MarkdownRenderer>
      </HoverCardContent>
    </HoverCard>
  );
}
