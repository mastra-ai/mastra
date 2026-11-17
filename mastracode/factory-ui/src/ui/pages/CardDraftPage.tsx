import { cardThreadSession } from '@mastra/factory/work-items/card-context-sessions';
import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Logo } from '@mastra/playground-ui/components/Logo';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconArrowRotateClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateClockwise';
import { IconTicket } from '@mastra/playground-ui/icons/central/IconTicket';
import { useEffect, useEffectEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { useBoardCatalog } from '../../hooks/useBoardCatalog';
import { useWorkItemQuery } from '../../hooks/useWorkItems';
import { ConfigurationErrorNotice, DraftStart, draftPageClass } from '../domains/chat/components/DraftStart';
import { EmptyThreadState, emptyThreadClass } from '../domains/chat/components/EmptyThreadState';
import { SessionView } from '../domains/chat/components/SessionView';
import { continueTranscript } from '../domains/chat/context/transcriptKey';
import { useChatSessionContext } from '../domains/chat/context/useChatSessionContext';
import { useDraftModelGuards } from '../domains/chat/hooks/useDraftModelGuards';
import { boardOf } from '../domains/factory/boardFlow';
import { currentItemStage } from '../domains/factory/boardStages';
import { CardDraftActions } from '../domains/factory/components/CardDraftActions';
import { useCardSessionRepository } from '../domains/factory/hooks/useCardSessionRepository';
import { useStartCardSessionFromDraft } from '../domains/factory/hooks/useStartCardSessionFromDraft';
import { settingsSectionPath } from '../domains/settings/settingsSections';
import { factoryHomePath, threadPath } from '../domains/workspaces/services/factoryPaths';

export function CardDraftPage({ workItemId }: { workItemId: string }) {
  const { factoryId = '', workItemId: routedWorkItemId } = useParams<{ factoryId: string; workItemId?: string }>();
  const guards = useDraftModelGuards(factoryId, 'factory');
  const card = useWorkItemQuery(factoryId, workItemId);
  const catalog = useBoardCatalog(factoryId);
  const factory = guards.activeFactory;
  const item = card.data ?? undefined;
  const unconfigured = guards.missingModel || guards.missingCredential !== undefined;
  const drafting = Boolean(routedWorkItemId && item && factory && !catalog.isPending && !unconfigured);
  const sessionRepository = useCardSessionRepository(factoryId, drafting ? item : undefined);
  const draftStart = useStartCardSessionFromDraft(
    factory,
    item,
    sessionRepository.error ? undefined : sessionRepository.data,
  );
  const { sessionId: draftSessionId } = useChatSessionContext();
  const navigate = useNavigate();
  const board = item && !catalog.isPending ? boardOf(catalog.data, item) : undefined;
  const cardSession =
    item && !catalog.isPending
      ? cardThreadSession(item, board?.phases, currentItemStage(item, board) ?? '')
      : undefined;
  const startOpensItsThread = draftStart.started;
  const openedSession = routedWorkItemId && !startOpensItsThread ? cardSession : undefined;
  const openedSessionId = openedSession?.sessionId;
  const openedThreadId = openedSession?.threadId;
  const openThread = useEffectEvent((session: { sessionId: string; threadId: string }) => {
    continueTranscript({ sessionId: draftSessionId }, session);
    void navigate(threadPath(factoryId, session), { replace: true });
  });
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
  if (!item || catalog.isPending || !factory) {
    return (
      <div className={draftPageClass} aria-busy="true">
        <Skeleton aria-label="Loading card" className="h-8 w-2/3" />
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
    );
  }
  if (unconfigured && !openedSession) return <DraftStart heading={item.title} guards={guards} />;

  return (
    <SessionView
      start={draftStart}
      openingSession={Boolean(openedSession)}
      emptyState={
        <section className={emptyThreadClass} aria-labelledby="card-draft-title">
          <Logo size="md" aria-label="Mastra Code" />
          <Txt as="h2" variant="title" tone="ink" id="card-draft-title" className="mt-7 max-w-2xl text-balance">
            {item.title}
          </Txt>
          <Txt variant="body-sm" tone="muted" className="mt-2 max-w-lg text-pretty">
            No session yet. Your first message starts one.
          </Txt>
          <div className="mt-7 flex w-full max-w-2xl flex-col items-center gap-3">
            {guards.configurationError && <ConfigurationErrorNotice error={guards.configurationError} />}
            <CardRepositoryNotice factoryId={factoryId} lookup={sessionRepository} />
            {board && <CardDraftActions factory={factory} item={item} board={board} />}
          </div>
        </section>
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
