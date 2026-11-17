import { useParams } from 'react-router';

import { useFactoryAuth } from '../../hooks/useFactoryAuth';
import { ChatPageLayout } from '../domains/chat/components/ChatPageLayout';
import { DraftStart } from '../domains/chat/components/DraftStart';
import { StarterBoard } from '../domains/chat/components/starters/StarterBoard';
import { ChatSessionBoundary } from '../domains/chat/context/ChatSessionProvider';
import { useDraftModelGuards } from '../domains/chat/hooks/useDraftModelGuards';
import type { DraftModelGuards } from '../domains/chat/hooks/useDraftModelGuards';
import { FactoryActivity } from '../domains/factory/components/activity/FactoryActivity';

export function NewPage() {
  const { factoryId, draftSessionId } = useParams<{ factoryId: string; draftSessionId: string }>();
  const guards = useDraftModelGuards(factoryId, 'user');

  return (
    <ChatPageLayout title="New session">
      {/* Remount only the chat content per draft, never the app shell. */}
      <ChatSessionBoundary key={draftSessionId}>
        <NewPageContent guards={guards} userDraft={draftSessionId !== undefined} />
      </ChatSessionBoundary>
    </ChatPageLayout>
  );
}

function NewPageContent({ guards, userDraft }: { guards: DraftModelGuards; userDraft: boolean }) {
  const firstName = useFactoryAuth().data?.user?.name?.trim().split(/\s+/)[0];
  const { activeFactory, missingModel, missingCredential } = guards;
  const startsFromPrompt = userDraft && activeFactory && !missingModel && !missingCredential;

  return (
    <DraftStart
      heading={firstName ? `What should we ship, ${firstName}?` : 'What should we ship?'}
      guards={guards}
      starters={startsFromPrompt && <StarterBoard factoryId={activeFactory.id} />}
    >
      {startsFromPrompt && <FactoryActivity factoryId={activeFactory.id} />}
    </DraftStart>
  );
}
