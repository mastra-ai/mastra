import { Loader2 } from 'lucide-react';
import { Shimmer } from '@/ds/components/Shimmer';
import { Txt } from '@/ds/components/Txt';

export interface ReasoningStreamingLineProps {
  text: string;
}

export const ReasoningStreamingLine = ({ text }: ReasoningStreamingLineProps) => (
  <Txt
    variant="ui-md"
    className="flex max-w-[80%] items-center gap-2 leading-relaxed whitespace-pre-wrap text-neutral4"
    as="div"
  >
    <Loader2 className="size-4 text-neutral3 motion-safe:animate-spin" />
    <Shimmer>{text}</Shimmer>
  </Txt>
);
