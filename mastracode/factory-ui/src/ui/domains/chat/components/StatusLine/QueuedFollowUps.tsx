import { useChatRuntime } from '../../context/useChatRuntime';
import { statusItem } from './statusItem';

export function QueuedFollowUps() {
  const { followUpCount } = useChatRuntime();

  if ((followUpCount ?? 0) <= 0) return null;

  return <span className={statusItem}>{followUpCount} queued</span>;
}
