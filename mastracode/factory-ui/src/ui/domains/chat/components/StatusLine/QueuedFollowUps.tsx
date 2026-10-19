import { useChatRuntime } from '../../context/useChatRuntime';
import { statusItem } from './statusItem';

/** Count of queued follow-up messages, shown only when work is pending. */
export function QueuedFollowUps() {
  const { followUpCount } = useChatRuntime();

  if ((followUpCount ?? 0) <= 0) return null;

  return <span className={statusItem}>{followUpCount} queued</span>;
}
