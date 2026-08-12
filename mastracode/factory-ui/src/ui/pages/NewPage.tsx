import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Bot, GitBranch } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';

import { Sidebar } from '../Sidebar';
import { ChatLayout } from '../layouts/ChatLayout';
import { FolderIcon } from '../ui/icons';
import { useFactoryQuery } from '../../hooks/useFactories';
import { useFactoryProjectQuery } from '../../hooks/useFactoryDefaultModel';
import { useProvidersQuery } from '../../hooks/use-providers';
import { useFactoryAuth } from '../../hooks/useFactoryAuth';
import { useUserSessionQuery } from '../../hooks/useWorkspaces';
import { providerDisplayName } from '../domains/settings/components/provider-display-name';
import { settingsSectionPath } from '../domains/settings/settingsSections';
import type { FactoryProject } from '../domains/workspaces/services/github';
import { ChatHeader } from '../domains/chat/components/ChatHeader';
import { ComposerPanel } from '../domains/chat/components/ComposerPanel';
import { TranscriptEntries } from '../domains/chat/components/Transcript';
import { ChatSessionBoundary } from '../domains/chat/context/ChatSessionProvider';
import { useChatTranscript } from '../domains/chat/context/useChatTranscript';
import { useGlobalShortcuts } from '../domains/chat/hooks/useGlobalShortcuts';

const draftStartClass = 'flex w-full max-w-xl flex-col items-stretch gap-6';

export function NewPage() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const activeFactory = factoryQuery.data;
  const projectQuery = useFactoryProjectQuery(activeFactory?.id);
  const providersQuery = useProvidersQuery();
  const defaultModelId = projectQuery.data?.defaultModelId ?? undefined;
  const missingDefaultModel = Boolean(activeFactory) && projectQuery.isSuccess && !defaultModelId;
  const defaultModelProvider = defaultModelId
    ? providersQuery.data?.find(entry => entry.provider === defaultModelId.split('/')[0])
    : undefined;
  const missingCredential =
    Boolean(activeFactory) && defaultModelId && defaultModelProvider?.source === 'none'
      ? { modelId: defaultModelId, provider: defaultModelProvider.provider }
      : undefined;
  const configurationError = projectQuery.error ?? providersQuery.error ?? undefined;

  return (
    <ChatLayout
      sidebar={<Sidebar />}
      header={<ChatHeader />}
      main={
        <ChatSessionBoundary>
          <NewPageContent
            activeFactory={activeFactory}
            missingDefaultModel={missingDefaultModel}
            missingCredential={missingCredential}
            configurationError={configurationError}
          />
        </ChatSessionBoundary>
      }
    />
  );
}

interface MissingCredentialGuard {
  modelId: string;
  provider: string;
}

function readRouteErrorNotice(state: unknown): string | undefined {
  if (typeof state !== 'object' || state === null || !('routeErrorNotice' in state)) return undefined;
  const { routeErrorNotice } = state;
  return typeof routeErrorNotice === 'string' ? routeErrorNotice : undefined;
}

function NewPageContent({
  activeFactory,
  missingDefaultModel,
  missingCredential,
  configurationError,
}: {
  activeFactory: FactoryProject | undefined;
  missingDefaultModel: boolean;
  missingCredential: MissingCredentialGuard | undefined;
  configurationError: Error | undefined;
}) {
  useGlobalShortcuts();
  const { transcript } = useChatTranscript();
  const location = useLocation();
  const routeErrorNotice = readRouteErrorNotice(location.state);
  const statusEntries = transcript.entries.filter(entry => entry.kind === 'notice' || entry.kind === 'error');
  const hasNotices = Boolean(routeErrorNotice) || statusEntries.length > 0;

  return (
    <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto px-4 py-10 md:px-6">
      <div className="flex w-full max-w-xl flex-col items-center gap-4">
        <DraftStart
          activeFactory={activeFactory}
          configurationError={configurationError}
          missingDefaultModel={missingDefaultModel}
          missingCredential={missingCredential}
        />
        {hasNotices && (
          <div className="flex w-full flex-col gap-4">
            {routeErrorNotice && <Notice variant="destructive">{routeErrorNotice}</Notice>}
            <TranscriptEntries entries={statusEntries} onApprove={() => undefined} onRespond={() => undefined} />
          </div>
        )}
      </div>
    </div>
  );
}

function DraftStart({
  activeFactory,
  configurationError,
  missingDefaultModel,
  missingCredential,
}: {
  activeFactory: FactoryProject | undefined;
  configurationError: Error | undefined;
  missingDefaultModel: boolean;
  missingCredential: MissingCredentialGuard | undefined;
}) {
  if (activeFactory && missingDefaultModel) {
    return (
      <section className={draftStartClass} aria-label="Model setup required">
        <MissingDefaultModelState factoryId={activeFactory.id} />
      </section>
    );
  }

  if (activeFactory && missingCredential) {
    return (
      <section className={draftStartClass} aria-label="Provider credential required">
        <MissingCredentialState factoryId={activeFactory.id} guard={missingCredential} />
      </section>
    );
  }

  return (
    <section className={draftStartClass} aria-labelledby="draft-start-heading">
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandLockup />
        <h1 id="draft-start-heading" className="text-icon6 m-0 text-2xl">
          What do you want to work on?
        </h1>
        <FactoryContext activeFactory={activeFactory} />
      </div>
      {configurationError && (
        <Notice variant="destructive">Failed to load session configuration: {configurationError.message}</Notice>
      )}

      {activeFactory && <ComposerPanel composerVariant="textarea" />}
    </section>
  );
}

function MissingCredentialState({ factoryId, guard }: { factoryId: string; guard: MissingCredentialGuard }) {
  const authQuery = useFactoryAuth();
  const providerName = providerDisplayName(guard.provider);
  const orgHint =
    authQuery.data?.authEnabled === true ? ', or ask an org admin to share an org-wide key with your team' : '';
  return (
    <EmptyState
      as="h2"
      iconSlot={<Bot size={40} className="text-icon3" />}
      titleSlot={`You don't have access to ${providerName}`}
      descriptionSlot={`The Factory default model (${guard.modelId}) needs a ${providerName} credential. Add your own key in Models settings${orgHint}.`}
      actionSlot={
        <Link to={settingsSectionPath(factoryId, 'models')} className={buttonVariants({ variant: 'primary' })}>
          Open Models settings
        </Link>
      }
    />
  );
}

function MissingDefaultModelState({ factoryId }: { factoryId: string }) {
  return (
    <EmptyState
      as="h2"
      iconSlot={<Bot size={40} className="text-icon3" />}
      titleSlot="No default model configured for this Factory"
      descriptionSlot="Connect a model provider and choose a default model in Models settings before starting a chat."
      actionSlot={
        <Link to={settingsSectionPath(factoryId, 'models')} className={buttonVariants({ variant: 'primary' })}>
          Open Models settings
        </Link>
      }
    />
  );
}

function BrandLockup() {
  return (
    <div className="text-icon3 inline-flex items-center gap-2">
      <LogoWithoutText aria-hidden className="h-4 w-auto" />
      <span className="text-ui-sm font-medium tracking-widest uppercase">Mastra Code</span>
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
    <div className="text-ui-sm text-icon3 flex max-w-full items-center justify-center gap-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <FolderIcon size={13} className="text-icon2 shrink-0" />
        <span className="shrink-0 font-medium">{activeFactory?.name ?? 'Factory'}</span>
        {projectPath && (
          <>
            <span className="text-icon2 shrink-0">·</span>
            <span className="text-icon2 min-w-0 truncate" title={projectPath}>
              {projectPath}
            </span>
          </>
        )}
      </div>
      {gitBranch && (
        <>
          <span aria-hidden className="text-icon2 shrink-0">
            ·
          </span>
          <div className="flex min-w-0 items-center gap-1.5">
            <GitBranch size={13} aria-hidden className="text-icon2 shrink-0" />
            <span className="min-w-0 truncate" title={gitBranch}>
              {gitBranch}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
