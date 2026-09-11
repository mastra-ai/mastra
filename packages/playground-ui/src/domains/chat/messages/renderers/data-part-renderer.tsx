import type { DataPart } from '@mastra/react';

import { SignalBadge } from '../signal-badge';
import { isSignalData } from '../signal-data';

export interface DataPartRendererProps {
  part: DataPart;
}

/**
 * Renders a `MessageFactory` `Data` slot. Only `data-signal` parts whose payload
 * is a recognized signal shape produce a `SignalBadge`; everything else renders
 * nothing.
 */
export const DataPartRenderer = ({ part }: DataPartRendererProps) => {
  if (part.type === 'data-signal' && isSignalData(part.data)) {
    return <SignalBadge signal={part.data} />;
  }

  return null;
};
