import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useWorkItemQuery } from '../../../../hooks/useWorkItems';
import { boardOf } from '../boardFlow';

export function useDraftCard(factoryId: string | undefined, workItemId: string | undefined) {
  const card = useWorkItemQuery(factoryId, workItemId);
  const catalog = useBoardCatalog(factoryId);
  const item = catalog.isPending ? undefined : (card.data ?? undefined);
  return { card, catalog, item, board: item && boardOf(catalog.data, item) };
}
