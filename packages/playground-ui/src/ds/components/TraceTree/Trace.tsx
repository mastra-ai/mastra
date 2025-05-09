import React from 'react';

import { Span, SpanProps } from './Span';
import { Spans } from './Spans';
import { TraceDurationProvider } from './Trace.context';

export interface TraceProps {
  name: string;
  spans: React.ReactNode;
  durationMs: number;
  tokenCount?: number;
  onClick?: () => void;
  variant: SpanProps['variant'];
  isActive?: boolean;
}

export const Trace = ({ name, spans, durationMs, tokenCount, onClick, variant, isActive }: TraceProps) => {
  return (
    <TraceDurationProvider durationMs={durationMs}>
      <Span
        isRoot
        durationMs={durationMs}
        variant={variant}
        spans={<Spans>{spans}</Spans>}
        onClick={onClick}
        isActive={isActive}
      >
        {name}
      </Span>
    </TraceDurationProvider>
  );
};
