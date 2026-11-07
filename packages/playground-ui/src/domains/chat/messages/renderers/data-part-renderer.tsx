import type { DataPart } from '@mastra/react/ui';

import { ComputerCard, ComputerControlRequest } from '../../computer/computer-card';
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
  const data = part.data as { computerId?: unknown; status?: unknown; control?: unknown; reason?: unknown } | undefined;
  const computerId = data?.computerId;
  if (part.type === 'data-computer' && typeof computerId === 'string' && data?.status === undefined) {
    // A control part, not an attachment: only the agent's request for the user shows.
    if (data?.control !== 'human') return null;
    return (
      <ComputerControlRequest computerId={computerId} reason={typeof data.reason === 'string' ? data.reason : undefined} />
    );
  }
  if (part.type === 'data-computer' && typeof computerId === 'string' && messageId && partIndex !== undefined) {
    return <ComputerCard messageId={messageId} partIndex={partIndex} computerId={computerId} />;
  }
  if (part.type === 'data-signal' && isSignalData(part.data)) {
    return <SignalBadge signal={part.data} />;
  }

  return null;
};
