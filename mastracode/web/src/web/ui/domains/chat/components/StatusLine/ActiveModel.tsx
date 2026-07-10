import { useChatSession } from '../../context/ChatSessionProvider';

/** Current model id, or the no-model fallback before the session syncs. */
export function ActiveModel() {
  const { transcript } = useChatSession();
  return <span className="text-icon3 tabular-nums">{transcript.modelId ?? 'no model'}</span>;
}
