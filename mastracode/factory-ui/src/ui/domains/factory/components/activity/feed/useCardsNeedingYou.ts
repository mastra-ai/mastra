import { useFactoryAttentionHistory } from '../../../../../../hooks/useFactoryAttention';
import { NEEDS_YOU_KINDS } from '../../../services/attention';

/** Shares Needs you's open query, so flagging the feed costs no extra request. */
export function useCardsNeedingYou(factoryId: string): ReadonlySet<string> {
  const openAttention = useFactoryAttentionHistory(factoryId, 'open', NEEDS_YOU_KINDS);
  return new Set(
    (openAttention.data?.pages ?? []).flatMap(page =>
      page.items.flatMap(item => (item.workItemId === null ? [] : [item.workItemId])),
    ),
  );
}
