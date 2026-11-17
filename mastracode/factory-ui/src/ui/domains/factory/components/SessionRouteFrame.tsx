import type { ReactNode } from 'react';
import { useParams } from 'react-router';

import { SessionFrame } from '../../chat/components/SessionFrame';
import { useCardDraftFrame } from '../hooks/useCardDraftFrame';
import { useThreadFrame } from '../hooks/useThreadFrame';
import { ThreadSubscriptionsRefresh } from './ThreadSubscriptionsRefresh';

/** One frame for a card draft and its thread, so a Start keeps the header and panel mounted. */
export function SessionRouteFrame({ children }: { children: ReactNode }) {
  const { workItemId } = useParams<{ workItemId?: string }>();
  const thread = useThreadFrame();
  const cardDraft = useCardDraftFrame(workItemId);
  return (
    <SessionFrame {...(cardDraft ?? thread)}>
      <ThreadSubscriptionsRefresh />
      {children}
    </SessionFrame>
  );
}
