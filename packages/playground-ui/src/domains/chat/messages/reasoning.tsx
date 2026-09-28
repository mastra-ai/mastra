import { ChevronRightIcon } from 'lucide-react';
import { ReasoningStreamingLine } from './reasoning-streaming-line';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ds/components/Collapsible';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { Shimmer } from '@/ds/components/Shimmer';

export interface ReasoningProps {
  text: string;
  redacted?: boolean;
  streaming?: boolean;
  /** Whether the passage starts expanded. Defaults to `true`. */
  defaultOpen?: boolean;
}

export const Reasoning = ({ text, redacted, streaming, defaultOpen = true }: ReasoningProps) => {
  const body = redacted ? 'Reasoning was redacted by the provider.' : text;

  if (!body.trim()) {
    return streaming ? <ReasoningStreamingLine text="Reasoning..." /> : null;
  }

  return (
    <Collapsible defaultOpen={defaultOpen} className="my-1.5 min-w-0">
      <CollapsibleTrigger className="flex cursor-pointer items-center gap-1.5 text-caption text-muted-foreground pointer-coarse:min-h-11">
        <ChevronRightIcon className="size-3.5 shrink-0" />
        {/* Shows the model is still thinking even while the passage is collapsed. */}
        <Shimmer active={!!streaming}>Reasoning</Shimmer>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-1.5 min-w-0 border-l-2 border-border pl-2.5 italic [&_p]:my-0.5">
        <MarkdownRenderer className="text-caption text-muted-foreground" streaming={streaming && !redacted}>
          {body}
        </MarkdownRenderer>
      </CollapsibleContent>
    </Collapsible>
  );
};
