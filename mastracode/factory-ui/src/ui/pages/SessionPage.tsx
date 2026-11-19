import { useState } from 'react';
import { useParams } from 'react-router';

import { EmptyThreadState } from '../domains/chat/components/EmptyThreadState';
import { SessionView } from '../domains/chat/components/SessionView';
import { CardDraftPage } from './CardDraftPage';

export function SessionPage() {
  const { workItemId } = useParams<{ workItemId?: string }>();
  // Lives as long as the transcript: a card's Start opens its thread on this same page, so nothing remounts.
  const [draftedCardId] = useState(workItemId);
  if (draftedCardId) return <CardDraftPage workItemId={draftedCardId} />;
  return <SessionView emptyState={<EmptyThreadState />} />;
}
