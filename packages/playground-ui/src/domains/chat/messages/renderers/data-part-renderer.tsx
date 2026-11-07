import type { DataPart } from '@mastra/react/ui';

import { ComputerCard } from '../../computer/computer-card';
import { SignalBadge } from '../signal-badge';
import { isSignalData } from '../signal-data';

export interface DataPartRendererProps {
  part: DataPart;
  /** Locates the part in the transcript; needed for `data-computer` cards. */
  messageId?: string;
  partIndex?: number;
}

/**
 * Renders a `MessageFactory` `Data` slot. Only `data-signal` parts whose payload
 * is a recognized signal shape produce a `SignalBadge`; everything else renders
 * nothing.
 */
export const DataPartRenderer = ({ part, messageId, partIndex }: DataPartRendererProps) => {
  const computerId = (part.data as { computerId?: unknown } | undefined)?.computerId;
  if (part.type === 'data-computer' && typeof computerId === 'string' && messageId && partIndex !== undefined) {
    return <ComputerCard messageId={messageId} partIndex={partIndex} computerId={computerId} />;
  }
  if (part.type === 'data-signal' && isSignalData(part.data)) {
    return <SignalBadge signal={part.data} />;
  }

  return null;
};
