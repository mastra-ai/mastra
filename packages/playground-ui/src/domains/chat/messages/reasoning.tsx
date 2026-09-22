import { ChevronRightIcon } from 'lucide-react';
import { ReasoningStreamingLine } from './reasoning-streaming-line';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ds/components/Collapsible';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';

export interface ReasoningProps {
  text: string;
  redacted?: boolean;
  streaming?: boolean;
}

export const Reasoning = ({ text, redacted, streaming }: ReasoningProps) => {
  const body = redacted ? 'Reasoning was redacted by the provider.' : text;

  if (!body.trim()) {
    return streaming ? <ReasoningStreamingLine text="Reasoning..." /> : null;
  }

  return (
    <Collapsible defaultOpen className="my-1.5 min-w-0">
      <CollapsibleTrigger className="text-caption text-muted-foreground flex cursor-pointer items-center gap-1.5 pointer-coarse:min-h-11">
        <ChevronRightIcon className="size-3.5 shrink-0" />
        Reasoning
      </CollapsibleTrigger>

      <CollapsibleContent className="border-border mt-1.5 min-w-0 border-l-2 pl-2.5 italic [&_p]:my-0.5">
        <MarkdownRenderer className="text-caption text-muted-foreground" streaming={streaming && !redacted}>
          {body}
        </MarkdownRenderer>
      </CollapsibleContent>
    </Collapsible>
  );
};
