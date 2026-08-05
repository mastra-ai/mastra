import { Circle } from 'lucide-react';

import { useChatConnection } from '../../context/useChatConnection';
import { useChatSessionContext } from '../../context/useChatSessionContext';
import { useChatTranscript } from '../../context/useChatTranscript';

const statusItem = 'inline-flex items-center gap-1 text-icon3 [&_svg]:text-icon2';

export function ConnectionActivity() {
  const { status } = useChatConnection();
  const { workspacePending } = useChatSessionContext();
  const { busy } = useChatTranscript();

  // Ahead of busy: a message queued against the preparing session marks the
  // transcript busy, and the wait is what the reader needs named.
  if (status === 'connecting' && workspacePending)
    return (
      <span className={statusItem} role="status" aria-live="polite">
        <Circle size={10} /> Preparing workspace…
      </span>
    );
  // Spinning composer ring is the visible cue; this keeps the state announced.
  if (busy)
    return (
      <span className="sr-only" role="status" aria-live="polite">
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
