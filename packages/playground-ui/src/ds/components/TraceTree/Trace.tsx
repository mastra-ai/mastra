import React from 'react';

import { Span, SpanProps } from './Span';
import { Spans } from './Spans';

export interface TraceProps {
  name: string;
  spans: React.ReactNode;
  durationMs: number;
  tokenCount?: number;
  onClick?: () => void;
  variant: SpanProps['variant'];
  isActive?: boolean;
  totalDurationMs: number;
}

export const Trace = ({
  name,
  spans,
  durationMs,
  tokenCount,
  onClick,
  variant,
  isActive,
  totalDurationMs,
}: TraceProps) => {
  return (
    <Span
      isRoot
      durationMs={durationMs}
      variant={variant}
      spans={<Spans>{spans}</Spans>}
      onClick={onClick}
      isActive={isActive}
      offsetMs={0}
      totalDurationMs={totalDurationMs}
    >
      {name}
    </Span>
  );
};
