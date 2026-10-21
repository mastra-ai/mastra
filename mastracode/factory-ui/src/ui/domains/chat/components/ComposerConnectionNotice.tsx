import { ComposerHeaderContent, ComposerHeaderRow } from '@mastra/playground-ui/components/Composer';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { WifiOff } from 'lucide-react';

import { useChatConnection } from '../context/useChatConnection';

export function ComposerConnectionNotice() {
  const { status } = useChatConnection();
  if (status !== 'reconnecting' && status !== 'error') return null;

  const disconnected = status === 'error';

  return (
    <ComposerHeaderRow
      tone={disconnected ? 'destructive' : 'default'}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {disconnected ? <WifiOff aria-hidden="true" /> : <Spinner size="sm" aria-hidden="true" role="presentation" />}
      <ComposerHeaderContent>
        {disconnected ? 'Connection lost. Check the server and reload to reconnect.' : 'Reconnecting…'}
      </ComposerHeaderContent>
    </ComposerHeaderRow>
  );
}
