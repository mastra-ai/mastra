import { getSignalName } from '@mastra/playground-ui';
import { useParams } from 'react-router';

export function SignalCrumb() {
  const { signalId } = useParams<{ signalId: string }>();
  if (!signalId) return null;

  return getSignalName(signalId);
}
