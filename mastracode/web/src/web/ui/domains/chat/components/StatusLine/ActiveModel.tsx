import { Badge } from '@mastra/playground-ui/components/Badge';

import { useChatModels } from '../../context/useChatModels';

function lastSegment(id: string): string {
  const parts = id.split('/');
  return parts[parts.length - 1] || id;
}

/** Current model id, or the no-model fallback before the session syncs. */
export function ActiveModel() {
  const { activeModelId } = useChatModels();
  return <Badge size="md">{activeModelId ? lastSegment(activeModelId) : 'no model'}</Badge>;
}
