import { ComposerHeaderContent, ComposerHeaderRow } from '@mastra/playground-ui/components/Composer';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Check, WifiOff } from 'lucide-react';

import type { ComposerConnectionNoticeState } from '../hooks/useComposerConnectionNotice';

const labels = {
  reconnecting: 'Reconnecting…',
  error: 'Connection lost. Check the server and reload to reconnect.',
  reconnected: 'Reconnected',
};

const tones = { reconnecting: 'default', error: 'destructive', reconnected: 'success' } as const;

export function ComposerConnectionNotice({ notice }: { notice: ComposerConnectionNoticeState }) {
  const disconnected = notice === 'error';
  const recovered = notice === 'reconnected';

  return (
    <ComposerHeaderRow tone={tones[notice]} role="status" aria-live="polite" aria-atomic="true">
      {disconnected && <WifiOff aria-hidden="true" />}
      {recovered && <Check aria-hidden="true" />}
      {notice === 'reconnecting' && <Spinner size="sm" aria-hidden="true" role="presentation" />}
      <ComposerHeaderContent>{labels[notice]}</ComposerHeaderContent>
    </ComposerHeaderRow>
  );
}
