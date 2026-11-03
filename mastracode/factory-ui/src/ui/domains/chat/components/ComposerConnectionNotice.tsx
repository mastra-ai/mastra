import { ComposerHeaderContent, ComposerHeaderRow } from '@mastra/playground-ui/components/Composer';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { WifiOff } from 'lucide-react';

export function ComposerConnectionNotice({ notice }: { notice: 'reconnecting' | 'error' }) {
  return notice === 'error' ? (
    <ComposerHeaderRow tone="destructive" role="status" aria-live="polite" aria-atomic="true">
      <WifiOff aria-hidden="true" />
      <ComposerHeaderContent>Connection lost. Check the server and reload to reconnect.</ComposerHeaderContent>
    </ComposerHeaderRow>
  ) : (
    <ComposerHeaderRow role="status" aria-live="polite" aria-atomic="true">
      <Spinner size="sm" aria-hidden="true" role="presentation" />
      <ComposerHeaderContent>Reconnecting…</ComposerHeaderContent>
    </ComposerHeaderRow>
  );
}
