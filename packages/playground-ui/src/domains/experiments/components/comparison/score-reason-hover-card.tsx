import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/ds/components/HoverCard';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { IconCircleInfo } from '@/ds/icons/central/IconCircleInfo';

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
  const iconClassName = 'text-muted-foreground hover:text-foreground [&>svg]:size-icon-sm';

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
        <IconCircleInfo />
      </HoverCardTrigger>
      {/* The card is portaled but still bubbles React events to the trigger's ancestors (e.g. a row button). */}
      <HoverCardContent side="left" align="start" className="max-w-100 p-0" onClick={event => event.stopPropagation()}>
        <ScrollArea maxHeight="20rem">
          <div className="px-3 py-2.5">
            <MarkdownRenderer>{reason}</MarkdownRenderer>
          </div>
        </ScrollArea>
      </HoverCardContent>
    </HoverCard>
  );
}
