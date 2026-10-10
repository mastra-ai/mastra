import type { DataPart } from '@mastra/react/ui';

import { CONNECT_REQUEST_PART_TYPE, isConnectRequestData } from '../connect-request';
import { ConnectRequestPart } from '../connect-request-part';
import { SignalBadge } from '../signal-badge';
import { isSignalData } from '../signal-data';

export interface DataPartRendererProps {
  part: DataPart;
}

/**
 * Renders a `MessageFactory` `Data` slot. Recognized `data-signal` parts produce a
 * `SignalBadge` and `data-mastra-connect-request` parts a connection request card;
 * everything else renders nothing.
 */
export const DataPartRenderer = ({ part }: DataPartRendererProps) => {
  if (part.type === 'data-signal' && isSignalData(part.data)) {
    return <SignalBadge signal={part.data} />;
  }

  if (part.type === CONNECT_REQUEST_PART_TYPE && isConnectRequestData(part.data)) {
    return <ConnectRequestPart request={part.data} />;
  }

  return null;
};
