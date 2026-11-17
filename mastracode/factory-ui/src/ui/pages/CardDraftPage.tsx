import { cardThreadSession } from '@mastra/factory/work-items/card-context-sessions';
import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Logo } from '@mastra/playground-ui/components/Logo';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconArrowRotateClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateClockwise';
import { IconTicket } from '@mastra/playground-ui/icons/central/IconTicket';
import { Link, Navigate, useParams } from 'react-router';

import { useBoardCatalog } from '../../hooks/useBoardCatalog';
import { useWorkItemQuery } from '../../hooks/useWorkItems';
import type { InstalledBoardInfo } from '../../api/types';
import { ConfigurationErrorNotice, DraftStart, draftPageClass } from '../domains/chat/components/DraftStart';
import { emptyThreadClass } from '../domains/chat/components/EmptyThreadState';
import { SessionChatSurface } from '../domains/chat/components/SessionChatSurface';
import { DraftSessionStartContext } from '../domains/chat/context/DraftSessionStartContext';
import { useDraftModelGuards } from '../domains/chat/hooks/useDraftModelGuards';
import { useGlobalShortcuts } from '../domains/chat/hooks/useGlobalShortcuts';
import { boardOf } from '../domains/factory/boardFlow';
import { currentItemStage } from '../domains/factory/boardStages';
import { CardDraftActions } from '../domains/factory/components/CardDraftActions';
import { useCardSessionRepository } from '../domains/factory/hooks/useCardSessionRepository';
import { useStartCardSessionFromDraft } from '../domains/factory/hooks/useStartCardSessionFromDraft';
import type { WorkItem } from '../domains/factory/services/workItems';
import { settingsSectionPath } from '../domains/settings/settingsSections';
import { factoryHomePath, threadPath } from '../domains/workspaces/services/factoryPaths';
import type { FactoryProject } from '../domains/workspaces/services/github';

export function CardDraftPage() {
  const { factoryId = '', workItemId = '' } = useParams<{ factoryId: string; workItemId: string }>();
  const guards = useDraftModelGuards(factoryId, 'factory');
  const card = useWorkItemQuery(factoryId, workItemId);
  const catalog = useBoardCatalog(factoryId);
  const factory = guards.activeFactory;

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
  if (!card.data || catalog.isPending || !factory) {
    return (
      <div className={draftPageClass} aria-busy="true">
        <Skeleton aria-label="Loading card" className="h-8 w-2/3" />
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
    );
  }

  const item = card.data;
  const board = boardOf(catalog.data, item);
  const session = cardThreadSession(item, board?.phases, currentItemStage(item, board) ?? '');
  if (guards.missingModel || guards.missingCredential) {
    if (session) return <Navigate replace to={threadPath(factoryId, session)} />;
    return <DraftStart heading={item.title} guards={guards} />;
  }
  return (
    <CardDraft
      factory={factory}
      item={item}
      board={board}
      session={session}
      configurationError={guards.configurationError}
    />
  );
}

function CardDraft({
  factory,
  item,
  board,
  session,
  configurationError,
}: {
  factory: FactoryProject;
  item: WorkItem;
  board: InstalledBoardInfo | undefined;
  session: { sessionId: string; threadId: string } | undefined;
  configurationError: Error | undefined;
}) {
  useGlobalShortcuts();
  const sessionRepository = useCardSessionRepository(factory.id, item);
  const draftStart = useStartCardSessionFromDraft(
    factory,
    item,
    sessionRepository.error ? undefined : sessionRepository.data,
  );
  // A card that gained a session elsewhere opens it instead of a second one. A Start here opens it with its prompt.
  if (session && !draftStart.started) return <Navigate replace to={threadPath(factory.id, session)} />;

  return (
    <DraftSessionStartContext.Provider value={draftStart}>
      <SessionChatSurface
        composerLabel="Thread composer"
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
              {configurationError && <ConfigurationErrorNotice error={configurationError} />}
              <CardRepositoryNotice factoryId={factory.id} lookup={sessionRepository} />
              {board && <CardDraftActions factory={factory} item={item} board={board} />}
            </div>
          </section>
        }
      />
    </DraftSessionStartContext.Provider>
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
