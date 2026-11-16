import { cardThreadSession } from '@mastra/factory/work-items/card-context-sessions';
import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Logo } from '@mastra/playground-ui/components/Logo';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconTicket } from '@mastra/playground-ui/icons/central/IconTicket';
import { useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router';

import { useBoardCatalog } from '../../hooks/useBoardCatalog';
import { useWorkItemQuery } from '../../hooks/useWorkItems';
import type { InstalledBoardInfo } from '../../api/types';
import { ChatPageLayout } from '../domains/chat/components/ChatPageLayout';
import {
  ConfigurationErrorNotice,
  DraftStart,
  draftPageClass,
  readRouteErrorNotice,
} from '../domains/chat/components/DraftStart';
import { emptyThreadClass } from '../domains/chat/components/EmptyThreadState';
import { SessionChatSurface } from '../domains/chat/components/SessionChatSurface';
import { ChatSessionBoundary } from '../domains/chat/context/ChatSessionProvider';
import { DraftSessionStartContext } from '../domains/chat/context/DraftSessionStartContext';
import { useDraftModelGuards } from '../domains/chat/hooks/useDraftModelGuards';
import type { DraftModelGuards } from '../domains/chat/hooks/useDraftModelGuards';
import { useGlobalShortcuts } from '../domains/chat/hooks/useGlobalShortcuts';
import { boardOf } from '../domains/factory/boardFlow';
import { currentItemStage } from '../domains/factory/boardStages';
import { CardDraftActions } from '../domains/factory/components/CardDraftActions';
import { CardStageBar } from '../domains/factory/components/CardStageBar';
import { useCardSessionRepository } from '../domains/factory/hooks/useCardSessionRepository';
import { useStartCardSessionFromDraft } from '../domains/factory/hooks/useStartCardSessionFromDraft';
import type { WorkItem } from '../domains/factory/services/workItems';
import { factoryHomePath, threadPath } from '../domains/workspaces/services/factoryPaths';
import type { FactoryProject, LinkedRepositoryPayload } from '../domains/workspaces/services/github';

const DRAFT_TITLE = 'New session';

export function CardDraftPage() {
  const {
    factoryId = '',
    workItemId = '',
    draftSessionId,
  } = useParams<{ factoryId: string; workItemId: string; draftSessionId: string }>();
  const guards = useDraftModelGuards(factoryId, 'factory');

  return (
    <ChatSessionBoundary key={draftSessionId}>
      <CardDraftContent factoryId={factoryId} workItemId={workItemId} guards={guards} />
    </ChatSessionBoundary>
  );
}

function CardDraftContent({
  factoryId,
  workItemId,
  guards,
}: {
  factoryId: string;
  workItemId: string;
  guards: DraftModelGuards;
}) {
  const card = useWorkItemQuery(factoryId, workItemId);
  const catalog = useBoardCatalog(factoryId);
  const factory = guards.activeFactory;

  if (card.isError) {
    return (
      <ChatPageLayout title={DRAFT_TITLE}>
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
      </ChatPageLayout>
    );
  }
  if (card.data === null) {
    return (
      <ChatPageLayout title={DRAFT_TITLE}>
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
      </ChatPageLayout>
    );
  }
  if (!card.data || catalog.isPending || !factory) {
    return (
      <ChatPageLayout title={DRAFT_TITLE}>
        <div className={draftPageClass} aria-busy="true">
          <Skeleton aria-label="Loading card" className="h-8 w-2/3" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      </ChatPageLayout>
    );
  }

  const item = card.data;
  const board = boardOf(catalog.data, item);
  // A card that gained a session, here or on the board, opens it instead of a second one.
  const session = cardThreadSession(item, board?.phases, currentItemStage(item, board) ?? '');
  if (session) return <Navigate replace to={threadPath(factoryId, session)} />;

  return (
    <ChatPageLayout
      title={DRAFT_TITLE}
      headerCenter={board && <CardStageBar item={item} sessionItems={[item]} board={board} factory={factory} />}
    >
      {guards.missingModel || guards.missingCredential ? (
        <DraftStart heading={item.title} guards={guards} />
      ) : (
        <CardDraft factory={factory} item={item} board={board} configurationError={guards.configurationError} />
      )}
    </ChatPageLayout>
  );
}

function CardDraft({
  factory,
  item,
  board,
  configurationError,
}: {
  factory: FactoryProject;
  item: WorkItem;
  board: InstalledBoardInfo | undefined;
  configurationError: Error | undefined;
}) {
  useGlobalShortcuts();
  const routeErrorNotice = readRouteErrorNotice(useLocation().state);
  const sessionRepository = useCardSessionRepository(factory.repositories, item);
  const [chosenSlug, setChosenSlug] = useState<string>();
  const choices = sessionRepository?.kind === 'choose' ? sessionRepository.choices : [];
  const chosen = choices.find(repository => repository.slug === chosenSlug);
  const repository = sessionRepository?.kind === 'resolved' ? sessionRepository.repository : chosen;
  const start = useStartCardSessionFromDraft(item, repository);

  return (
    <DraftSessionStartContext.Provider value={{ ready: repository !== undefined, start }}>
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
              {routeErrorNotice && <Notice variant="destructive">{routeErrorNotice}</Notice>}
              {configurationError && <ConfigurationErrorNotice error={configurationError} />}
              {sessionRepository?.kind === 'unavailable' && (
                <Notice variant="warning">{sessionRepository.reason}</Notice>
              )}
              {board && <CardDraftActions factory={factory} item={item} board={board} chosenRepository={chosen} />}
              {choices.length > 0 && (
                <RepositorySelect choices={choices} value={chosen?.slug} onChange={setChosenSlug} />
              )}
            </div>
          </section>
        }
      />
    </DraftSessionStartContext.Provider>
  );
}

function RepositorySelect({
  choices,
  value,
  onChange,
}: {
  choices: LinkedRepositoryPayload[];
  value: string | undefined;
  onChange: (slug: string) => void;
}) {
  return (
    <Select
      value={value ?? null}
      onValueChange={slug => {
        if (slug) onChange(slug);
      }}
    >
      <SelectTrigger size="sm" aria-label="Repository" className="w-fit max-w-full">
        <Txt as="span" variant="caption" className="truncate">
          {value ?? 'Choose a repository'}
        </Txt>
      </SelectTrigger>
      <SelectContent>
        {choices.map(choice => (
          <SelectItem key={choice.projectRepositoryId} value={choice.slug}>
            {choice.slug}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
