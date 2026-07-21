import { useChatRuntime } from '../../context/useChatRuntime';

const statusItem = 'inline-flex items-center gap-1 text-icon3 [&_svg]:text-icon2';

/** Count of queued follow-up messages, shown only when work is pending. */
export function QueuedFollowUps() {
  const { followUpCount } = useChatRuntime();

  if ((followUpCount ?? 0) <= 0) return null;

  return <span className={statusItem}>{followUpCount} queued</span>;
}
