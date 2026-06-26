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
    className="whitespace-pre-wrap leading-relaxed text-neutral4 max-w-[80%] flex items-center gap-2"
    as="div"
  >
    <Loader2 className="animate-spin size-4 text-neutral3" />
    <Shimmer>{text}</Shimmer>
  </Txt>
);
