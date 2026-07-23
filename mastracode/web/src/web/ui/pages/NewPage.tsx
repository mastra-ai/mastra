import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Bot, GitBranch } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';

import { Sidebar } from '../Sidebar';
import { ChatLayout } from '../layouts/ChatLayout';
import { FolderIcon } from '../ui/icons';
import { useFactoryQuery } from '../../../shared/hooks/useFactories';
import { useFactoryProjectQuery } from '../../../shared/hooks/useFactoryDefaultModel';
import { useUserSessionQuery } from '../../../shared/hooks/useWorkspaces';
import type { FactoryProject } from '../domains/workspaces/services/github';
import { ChatHeader } from '../domains/chat/components/ChatHeader';
import { ComposerPanel } from '../domains/chat/components/ComposerPanel';
import { TranscriptEntries } from '../domains/chat/components/Transcript';
import { ChatSessionBoundary } from '../domains/chat/context/ChatSessionProvider';
import { useChatTranscript } from '../domains/chat/context/useChatTranscript';
import { useGlobalShortcuts } from '../domains/chat/hooks/useGlobalShortcuts';
import { Spinner } from '@mastra/playground-ui/components/Spinner';

const draftStartClass = 'flex w-full max-w-xl flex-col items-stretch gap-6';

export function NewPage() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const activeFactory = factoryQuery.data;
  const projectQuery = useFactoryProjectQuery(activeFactory?.id);
  const resolvingModelGuard = factoryQuery.isPending || (Boolean(activeFactory) && projectQuery.isPending);
  const missingDefaultModel = Boolean(activeFactory) && projectQuery.isSuccess && !projectQuery.data?.defaultModelId;

  return (
    <ChatLayout
      sidebar={<Sidebar />}
      header={<ChatHeader />}
      main={
        <ChatSessionBoundary>
          {resolvingModelGuard ? (
            <div className="grid min-h-0 flex-1 place-items-center">
              <Spinner aria-label="Loading Factory" className="text-icon3" />
            </div>
          ) : (
            <NewPageContent activeFactory={activeFactory} missingDefaultModel={missingDefaultModel} />
          )}
        </ChatSessionBoundary>
      }
    />
  );
}

function NewPageContent({
  activeFactory,
  missingDefaultModel,
}: {
  activeFactory: FactoryProject | undefined;
  missingDefaultModel: boolean;
}) {
  useGlobalShortcuts();
  const { transcript } = useChatTranscript();
  const location = useLocation();
  const locationState = location.state as { routeErrorNotice?: string } | null;
  const routeErrorNotice = locationState?.routeErrorNotice ?? null;
  const noticeEntries = transcript.entries.filter(entry => entry.kind === 'notice');
  const hasNotices = Boolean(routeErrorNotice) || noticeEntries.length > 0;

  return (
    <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto px-4 py-10 md:px-6">
      <div className="flex w-full max-w-xl flex-col items-center gap-4">
        <DraftStart activeFactory={activeFactory} missingDefaultModel={missingDefaultModel} />
        {hasNotices && (
          <div className="flex w-full flex-col gap-4">
            {routeErrorNotice && <Notice variant="destructive">{routeErrorNotice}</Notice>}
            <TranscriptEntries entries={noticeEntries} onApprove={() => undefined} onRespond={() => undefined} />
          </div>
        )}
      </div>
    </div>
  );
}

function DraftStart({
  activeFactory,
  missingDefaultModel,
}: {
  activeFactory: FactoryProject | undefined;
  missingDefaultModel: boolean;
}) {
  if (activeFactory && missingDefaultModel) {
    return (
      <section className={draftStartClass} aria-label="Model setup required">
        <MissingDefaultModelState factoryId={activeFactory.id} />
      </section>
    );
  }

  return (
    <section className={draftStartClass} aria-labelledby="draft-start-heading">
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandLockup />
        <h1 id="draft-start-heading" className="m-0 text-2xl text-icon6">
          What do you want to work on?
        </h1>
        <FactoryContext activeFactory={activeFactory} />
      </div>

      {activeFactory && <ComposerPanel composerVariant="textarea" />}
    </section>
  );
}

function MissingDefaultModelState({ factoryId }: { factoryId: string }) {
  return (
    <EmptyState
      as="h2"
      iconSlot={<Bot size={40} className="text-icon3" />}
      titleSlot="No default model configured for this Factory"
      descriptionSlot="Connect a model provider and choose a default model in Model settings before starting a chat."
      actionSlot={
        <Link to={`/factories/${factoryId}/settings/model`} className={buttonVariants({ variant: 'primary' })}>
          Open Model settings
        </Link>
      }
    />
  );
}

function BrandLockup() {
  return (
    <div className="inline-flex items-center gap-2 text-icon3">
      <LogoWithoutText aria-hidden className="h-4 w-auto" />
      <span className="text-ui-sm font-medium uppercase tracking-widest">Mastra Code</span>
    </div>
  );
}

function FactoryContext({ activeFactory }: { activeFactory: FactoryProject | undefined }) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const sessionQuery = useUserSessionQuery(sessionId);
  const repository = activeFactory?.repositories.find(
    repo => repo.projectRepositoryId === sessionQuery.data?.projectRepositoryId,
  );
  const projectPath = sessionQuery.data?.sessionId;
  const gitBranch = repository?.gitBranch;
  return (
    <div className="flex max-w-full items-center justify-center gap-1.5 text-ui-sm text-icon3">
      <div className="flex min-w-0 items-center gap-1.5">
        <FolderIcon size={13} className="shrink-0 text-icon2" />
        <span className="shrink-0 font-medium">{activeFactory?.name ?? 'Factory'}</span>
        {projectPath && (
          <>
            <span className="shrink-0 text-icon2">·</span>
            <span className="min-w-0 truncate text-icon2" title={projectPath}>
              {projectPath}
            </span>
          </>
        )}
      </div>
      {gitBranch && (
        <>
          <span aria-hidden className="shrink-0 text-icon2">
            ·
          </span>
          <div className="flex min-w-0 items-center gap-1.5">
            <GitBranch size={13} aria-hidden className="shrink-0 text-icon2" />
            <span className="min-w-0 truncate" title={gitBranch}>
              {gitBranch}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
