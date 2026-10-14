import { HoverCard, HoverCardContent, HoverCardTrigger } from '@mastra/playground-ui/components/HoverCard';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { InfoIcon } from 'lucide-react';

export function ScoreReasonHoverCard({ scorerId, reason }: { scorerId: string; reason: string }) {
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={0}
        closeDelay={100}
        render={
          <button
            type="button"
            aria-label={`Show ${scorerId} reason`}
            className="cursor-pointer text-muted-foreground hover:text-foreground [&>svg]:size-3.5"
          />
        }
      >
        <InfoIcon />
      </HoverCardTrigger>
      <HoverCardContent side="left" align="start" className="max-h-80 max-w-100 overflow-y-auto">
        <MarkdownRenderer>{reason}</MarkdownRenderer>
      </HoverCardContent>
    </HoverCard>
  );
}
