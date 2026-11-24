import { useChatConnection } from '../../context/useChatConnection';
import { useChatSessionContext } from '../../context/useChatSessionContext';
import { useChatTranscript } from '../../context/useChatTranscript';
import { usePreparingThreadId } from '../../hooks/usePreparingThreadId';
import { IconFormCircle } from '@mastra/playground-ui/icons/central/IconFormCircle';

const statusItem = 'inline-flex items-center gap-1 text-muted-foreground [&_svg]:text-subtle-foreground';

export function ConnectionActivity() {
  const { status } = useChatConnection();
  const { workspacePending } = useChatSessionContext();
  const { phase } = useChatTranscript();
  const preparingThreadId = usePreparingThreadId();

  // The notice above the composer owns connection failures; other activity is stale until recovery.
  if (status === 'reconnecting' || status === 'error') return null;
  // preparing message sets busy; preparation status takes precedence
  if (preparingThreadId)
    return (
      <span className={statusItem} role="status" aria-live="polite">
        <IconFormCircle className="size-icon-xs" /> {workspacePending ? 'Preparing workspace…' : 'Connecting…'}
      </span>
    );
  // Spinning composer ring is the visible cue; this keeps the state announced.
  if (phase === 'working')
    return (
      <span className="sr-only" role="status" aria-live="polite">
        Working…
      </span>
    );
  return null;
}
