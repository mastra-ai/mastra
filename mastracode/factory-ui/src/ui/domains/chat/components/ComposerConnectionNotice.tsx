import { ComposerHeaderContent, ComposerHeaderRow } from '@mastra/playground-ui/components/Composer';
import { WifiOff } from 'lucide-react';

/** Only a failed connection takes the header; a reconnect stays in the status line. */
export function ComposerConnectionNotice() {
  return (
    <ComposerHeaderRow tone="destructive" role="status" aria-live="polite" aria-atomic="true">
      <WifiOff aria-hidden="true" />
      <ComposerHeaderContent>Connection lost. Check the server and reload to reconnect.</ComposerHeaderContent>
    </ComposerHeaderRow>
  );
}
