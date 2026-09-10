import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { updateFactoryAttentionReceipt } from '../ui/domains/factory/services/attention';
import { unreadItemsForSession } from '../ui/domains/workspaces/services/sessionAttention';
import { ATTENTION_PREVIEW_LIMIT, useFactoryAttention } from './useFactoryAttention';

/**
 * Opening a session is reading it: post the read receipt its unread attention
 * is waiting on, so the sidebar's unread dot clears. Nothing else on a session
 * route writes one — the popover and the inbox were the only writers — so
 * without this the dot a session earns is permanent.
 *
 * Reads the page the sidebar already fetched (same query key, same arguments),
 * so this costs no extra poll. That page is capped at `ATTENTION_PREVIEW_LIMIT`,
 * which makes the sweep best-effort by construction: an item that fell past the
 * cap keeps its dot until the inbox settles it. Fine — the inbox is where a
 * backlog that size belongs.
 *
 * Fires once per session. Receipts are keyed by kind + source + occurrence, so
 * a duplicate post would be harmless, but the mutation invalidates the
 * attention query and a re-fire on the refetched page would loop.
 */
export function useMarkSessionAttentionRead(factoryProjectId: string | undefined, sessionId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const attention = useFactoryAttention(factoryProjectId, 'open', ATTENTION_PREVIEW_LIMIT, 'attention');
  const items = attention.data?.items;
  const sweptSession = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!factoryProjectId || !sessionId || !items) return;
    if (sweptSession.current === sessionId) return;

    const unread = unreadItemsForSession(items, sessionId);
    // Claim the session even with nothing to post: the page is loaded and this
    // visit is accounted for. Anything arriving later is unread again, and the
    // reader is looking at it live.
    sweptSession.current = sessionId;
    if (unread.length === 0) return;

    void (async () => {
      // A park that resumed between this cached page and the post answers 409
      // (`attention_item_not_current`); a receipt nobody asked for must stay
      // silent either way, so every rejection is swallowed rather than toasted.
      await Promise.allSettled(
        unread.map(item => updateFactoryAttentionReceipt(baseUrl, factoryProjectId, item, 'read')),
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.factoryAttentionRoot(factoryProjectId) });
    })();
  }, [baseUrl, factoryProjectId, items, queryClient, sessionId]);
}
