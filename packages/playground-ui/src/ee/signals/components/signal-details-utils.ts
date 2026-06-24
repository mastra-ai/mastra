import { signals } from '../signals-data';

export function getSignalName(signalId: string) {
  return signals.find(signal => signal.id === signalId)?.name ?? signalId;
}
