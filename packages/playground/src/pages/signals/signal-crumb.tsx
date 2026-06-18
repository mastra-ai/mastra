import { useParams } from 'react-router';
import { signals } from './signals-data';

export function SignalCrumb() {
  const { signalId } = useParams<{ signalId: string }>();
  if (!signalId) return null;

  return signals.find(signal => signal.id === signalId)?.name ?? signalId;
}
