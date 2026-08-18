import { Shimmer } from '@mastra/playground-ui/components/Shimmer';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Loader2 } from 'lucide-react';

export interface ReasoningStreamingLineProps {
  text: string;
}

/**
 * One-line streaming reasoning indicator: a spinner plus the shared `Shimmer`
 * leaf. Kept as its own composable primitive instead of adding a `streaming`
 * flag to the collapsible `Reasoning` panel.
 */
export const ReasoningStreamingLine = ({ text }: ReasoningStreamingLineProps) => (
  <Txt
    variant="ui-md"
    className="text-neutral4 flex max-w-[80%] items-center gap-2 leading-relaxed whitespace-pre-wrap"
    as="div"
  >
    <Loader2 className="text-neutral3 size-4 animate-spin" />
    <Shimmer>{text}</Shimmer>
  </Txt>
);
