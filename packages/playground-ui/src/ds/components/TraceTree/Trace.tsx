import React from 'react';

import { Span } from './Span';
import { Spans } from './Spans';
import { TraceDurationProvider } from './Trace.context';

export interface TraceProps {
  name: string;
  spans: React.ReactNode;
  durationMs: number;
  tokenCount?: number;
  onClick?: () => void;
}

export const Trace = ({ name, spans, durationMs, tokenCount, onClick }: TraceProps) => {
  return (
    <TraceDurationProvider durationMs={durationMs}>
      <Span isRoot durationMs={durationMs} variant={'other'} spans={<Spans>{spans}</Spans>} onClick={onClick}>
        {name}
      </Span>
    </TraceDurationProvider>
  );
};
