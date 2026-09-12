import { cn } from '@mastra/playground-ui/utils/cn';
import { Circle } from 'lucide-react';

import { useChatConnection } from '../../context/useChatConnection';
import { useChatSessionContext } from '../../context/useChatSessionContext';
import { useChatTranscript } from '../../context/useChatTranscript';
import { usePreparingThreadId } from '../../hooks/usePreparingThreadId';

const statusItem = 'inline-flex items-center gap-1 text-icon3 [&_svg]:text-icon2';

export function ConnectionActivity() {
  const { status } = useChatConnection();
  const { workspacePending } = useChatSessionContext();
  const { phase } = useChatTranscript();
  const preparingThreadId = usePreparingThreadId();

  if (status === 'conflict')
    return (
      <span className={cn(statusItem, 'text-accent2 [&_svg]:text-accent2')} role="status" aria-live="polite">
        <Circle size={10} className="shrink-0" /> Session switched threads. Continue in the other tab or reload to
        reopen this thread.
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
      <span
        className={cn(statusItem, 'text-accent2 [&_svg]:text-accent2')}
        role="status"
        aria-live="polite"
        title="Check the server and reload to reconnect"
      >
        <Circle size={10} /> Disconnected
      </span>
    );
  if (preparingThreadId)
    return (
      <span className={statusItem} role="status" aria-live="polite">
        <Circle size={10} /> {workspacePending ? 'Preparing workspace…' : 'Connecting…'}
      </span>
    );
  if (phase === 'working')
    return (
      <span className="sr-only" role="status" aria-live="polite">
        Working…
      </span>
    );
  return null;
}
