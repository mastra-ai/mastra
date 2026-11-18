import { cardThreadSession } from '@mastra/factory/work-items/card-context-sessions';
import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconArrowRotateClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateClockwise';
import { IconTicket } from '@mastra/playground-ui/icons/central/IconTicket';
import { useEffect, useEffectEvent } from 'react';
import { Link, useParams } from 'react-router';

import { ConfigurationErrorNotice, DraftStart, draftPageClass } from '../domains/chat/components/DraftStart';
import { EmptyThreadState } from '../domains/chat/components/EmptyThreadState';
import { SessionView } from '../domains/chat/components/SessionView';
import { useContinueIntoThread } from '../domains/chat/context/transcriptKey';
import { useDraftModelGuards } from '../domains/chat/hooks/useDraftModelGuards';
import { currentItemStage } from '../domains/factory/boardStages';
import { CardDraftActions } from '../domains/factory/components/CardDraftActions';
import { useCardSessionRepository } from '../domains/factory/hooks/useCardSessionRepository';
import { useDraftCard } from '../domains/factory/hooks/useDraftCard';
import { useStartCardSessionFromDraft } from '../domains/factory/hooks/useStartCardSessionFromDraft';
import { settingsSectionPath } from '../domains/settings/settingsSections';
import { factoryHomePath } from '../domains/workspaces/services/factoryPaths';
import { CardDraftIntro } from './CardDraftIntro';
import { CardDraftSkeleton } from './CardDraftSkeleton';

export function CardDraftPage({ workItemId }: { workItemId: string }) {
  const { factoryId = '', workItemId: routedWorkItemId } = useParams<{ factoryId: string; workItemId?: string }>();
  const guards = useDraftModelGuards(factoryId, 'factory');
  const { card, item, board } = useDraftCard(factoryId, workItemId);
  const factory = guards.activeFactory;
  const unconfigured = guards.missingModel || guards.missingCredential !== undefined;
  const drafting = Boolean(routedWorkItemId && item && factory && !unconfigured);
  const sessionRepository = useCardSessionRepository(factoryId, drafting ? item : undefined);
  const draftStart = useStartCardSessionFromDraft(
    factory,
    item,
    sessionRepository.error || sessionRepository.isPlaceholderData ? undefined : sessionRepository.data,
  );
  const continueIntoThread = useContinueIntoThread();
  const cardSession = item && cardThreadSession(item, board?.phases, currentItemStage(item, board) ?? '');
  const openedSession =
    routedWorkItemId && cardSession && !draftStart.ownsSession(cardSession.sessionId) ? cardSession : undefined;
  const openedSessionId = openedSession?.sessionId;
  const openedThreadId = openedSession?.threadId;
  const openThread = useEffectEvent((session: { sessionId: string; threadId: string }) =>
    continueIntoThread(factoryId, session),
  );
  useEffect(() => {
    if (openedSessionId && openedThreadId) openThread({ sessionId: openedSessionId, threadId: openedThreadId });
  }, [openedSessionId, openedThreadId]);

  const threadOpened = !routedWorkItemId;
  if (threadOpened) return <SessionView emptyState={<EmptyThreadState />} />;
  if (card.isLoadingError) {
    return (
      <div className={draftPageClass}>
        <EmptyState
          as="h2"
          iconSlot={<IconTicket />}
          titleSlot="Could not load this card"
          descriptionSlot={card.error.message}
          actionSlot={
            <Button variant="primary" onClick={() => void card.refetch()}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }
  if (card.data === null) {
    return (
      <div className={draftPageClass}>
        <EmptyState
          as="h2"
          iconSlot={<IconTicket />}
          titleSlot="This card no longer exists"
          descriptionSlot="It was removed from the board."
          actionSlot={
            <Link to={factoryHomePath({ id: factoryId })} className={buttonVariants({ variant: 'primary' })}>
              Back to the board
            </Link>
          }
        />
      </div>
    );
  }
  if (!item || !factory) return <CardDraftSkeleton />;
  if (unconfigured && !openedSession) return <DraftStart heading={item.title} guards={guards} />;

  return (
    <SessionView
      start={openedSession ? { ...draftStart, ready: false } : draftStart}
      openingSession={Boolean(openedSession)}
      emptyState={
        <CardDraftIntro
          titleId="card-draft-title"
          title={
            <Txt as="h2" variant="title" tone="ink" id="card-draft-title">
              {item.title}
            </Txt>
          }
          actions={
            <>
              {guards.configurationError && <ConfigurationErrorNotice error={guards.configurationError} />}
              <CardRepositoryNotice factoryId={factoryId} lookup={sessionRepository} />
              {board && <CardDraftActions factory={factory} item={item} board={board} />}
            </>
          }
        />
      }
    />
  );
}

function CardRepositoryNotice({
  factoryId,
  lookup,
}: {
  factoryId: string;
  lookup: ReturnType<typeof useCardSessionRepository>;
}) {
  if (lookup.error) {
    return (
      <Notice
        variant="warning"
        action={
          <Notice.Button onClick={() => void lookup.refetch()} disabled={lookup.isFetching}>
            Retry <IconArrowRotateClockwise />
          </Notice.Button>
        }
      >
        {`Could not find this card's repository: ${lookup.error.message}`}
      </Notice>
    );
  }
  if (lookup.data?.status !== 'unlinked') return null;
  return (
    <Notice
      variant="warning"
      action={
        <Notice.Button render={<Link to={settingsSectionPath(factoryId, 'repositories')} />}>
          Open repository settings
        </Notice.Button>
      }
    >
      {lookup.data.hint}
    </Notice>
  );
}
