import { Circle } from 'lucide-react';

import { useChatConnection } from '../../context/useChatConnection';
import { useChatTranscript } from '../../context/useChatTranscript';

const statusItem = 'inline-flex items-center gap-1 text-icon3 [&_svg]:text-icon2';

export function ConnectionActivity() {
  const { status } = useChatConnection();
  const { busy } = useChatTranscript();

  if (busy)
    return (
      <span className={statusItem} role="status" aria-live="polite">
        Working…
      </span>
    );
  if (status === 'reconnecting')
    return (
      <span className={statusItem} role="status" aria-live="polite">
        <Circle size={10} /> Reconnecting…
      </span>
    );
  if (status === 'error')
    return (
      <span className={statusItem} role="status" aria-live="polite">
        <Circle size={10} /> Disconnected
      </span>
    );
  return null;
}
