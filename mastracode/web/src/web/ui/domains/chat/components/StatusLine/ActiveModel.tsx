import { useChatModels } from '../../context/useChatModels';

function lastSegment(id: string): string {
  const parts = id.split('/');
  return parts[parts.length - 1] || id;
}

/** Current model id, or the no-model fallback before the session syncs. */
export function ActiveModel() {
  const { activeModelId } = useChatModels();
  return <span className="text-icon3 tabular-nums">{activeModelId ? lastSegment(activeModelId) : 'no model'}</span>;
}
