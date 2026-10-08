import { useParams, useSearchParams } from 'react-router';

import { KnowledgeFlyout } from '../../factory/components/knowledge/KnowledgeFlyout';

/**
 * The knowledge page's node panel, opened over the session stage by `?node=<id>&record=<id>`
 * on the current route (reminder source chips set them). Closing drops the params.
 */
export function SessionKnowledgeFlyout() {
  const { factoryId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const nodeId = searchParams.get('node');
  if (!factoryId || !nodeId) return null;

  const update = (record: string | null, node: string | null) =>
    setSearchParams(
      current => {
        const next = new URLSearchParams(current);
        if (node) next.set('node', node);
        else next.delete('node');
        if (record) next.set('record', record);
        else next.delete('record');
        return next;
      },
      { replace: true, preventScrollReset: true },
    );

  return (
    <KnowledgeFlyout
      factoryProjectId={factoryId}
      nodeId={nodeId}
      focusRecordId={searchParams.get('record') ?? undefined}
      onSelectRecord={recordId => update(recordId, nodeId)}
      onClose={() => update(null, null)}
    />
  );
}
