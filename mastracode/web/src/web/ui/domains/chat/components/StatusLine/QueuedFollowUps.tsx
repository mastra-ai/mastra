import { useChatTranscript } from '../../context/useChatTranscript';

const statusItem = 'inline-flex items-center gap-1 text-icon3 [&_svg]:text-icon2';

/** Count of queued follow-up messages, shown only when work is pending. */
export function QueuedFollowUps() {
  const { transcript } = useChatTranscript();
  const { followUpCount } = transcript;

  if ((followUpCount ?? 0) <= 0) return null;

  return <span className={statusItem}>{followUpCount} queued</span>;
}
