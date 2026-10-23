import { Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Bot, GitBranch } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';

import { FolderIcon } from '../ui/icons';
import { useFactoryQuery } from '../../hooks/useFactories';
import { useFactoryProjectQuery } from '../../hooks/useFactoryDefaultModel';
import { useDefaultModelQuery } from '../../hooks/use-default-model';
import { useProvidersQuery } from '../../hooks/use-providers';
import { useUserSessionQuery } from '../../hooks/useWorkspaces';
import { providerDisplayName } from '@mastra/factory/provider-display-name';
import { isConnectedAt } from '../domains/settings/components/provider-credential';
import { MODEL_DEFAULTS_LABELS } from '../domains/settings/components/models/routing/model-routes';
import {
  MODEL_DEFAULTS_ANCHORS,
  sessionDefaultsAnchor,
  settingsSectionPath,
} from '../domains/settings/settingsSections';
import type { ModelDefaultsAnchor } from '../domains/settings/settingsSections';
import type { FactoryProject } from '../domains/workspaces/services/github';
import { ChatPageLayout } from '../domains/chat/components/ChatPageLayout';
import { ComposerPanel } from '../domains/chat/components/ComposerPanel';
import { TranscriptEntries } from '../domains/chat/components/Transcript';
import { chatStartModelId } from '../domains/chat/context/chatDefaultModel';
import { ChatSessionBoundary } from '../domains/chat/context/ChatSessionProvider';
import { useChatTranscript } from '../domains/chat/context/useChatTranscript';
import { useGlobalShortcuts } from '../domains/chat/hooks/useGlobalShortcuts';
import { Txt } from '@mastra/playground-ui/components/Txt';

const draftStartClass = 'flex min-w-0 w-full max-w-xl flex-col items-stretch gap-6';

export function NewPage() {
  const { factoryId, draftSessionId } = useParams<{ factoryId: string; draftSessionId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const activeFactory = factoryQuery.data;
  const projectQuery = useFactoryProjectQuery(activeFactory?.id);
  const personalDefaultQuery = useDefaultModelQuery();
  const providersQuery = useProvidersQuery();
  const chatModelId = chatStartModelId(projectQuery.data?.modelScope, {
    factory: projectQuery.data?.defaultModelId,
    personal: personalDefaultQuery.data?.modelId,
  });
  const chatModelSettled = Boolean(activeFactory) && projectQuery.isSuccess && !personalDefaultQuery.isPending;
  const missingDefaultModel = chatModelSettled && !chatModelId;
  const chatModelProvider = chatModelId
    ? providersQuery.data?.find(entry => entry.provider === chatModelId.split('/')[0])
    : undefined;
  const chatCredentialScope = projectQuery.data?.modelScope === 'factory' ? 'org' : 'user';
  const missingCredential =
    chatModelSettled && chatModelId && chatModelProvider && !isConnectedAt(chatModelProvider, chatCredentialScope)
      ? { modelId: chatModelId, provider: chatModelProvider.provider }
      : undefined;
  const configurationError = projectQuery.error ?? providersQuery.error ?? undefined;

  return (
    <ChatPageLayout
      crumbs={
        <>
          <Crumb as="span">User sessions</Crumb>
          <Crumb as="span" isCurrent>
            New session
          </Crumb>
        </>
      }
    >
      {/* Remount only the chat content per draft, never the app shell. */}
      <ChatSessionBoundary key={draftSessionId}>
        <NewPageContent
          activeFactory={activeFactory}
          missingDefaultModel={missingDefaultModel}
          missingCredential={missingCredential}
          configurationError={configurationError}
        />
      </ChatSessionBoundary>
    </ChatPageLayout>
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
  const noticeEntries = transcript.entries.filter(entry => entry.kind === 'notice');
  const hasNotices = Boolean(routeErrorNotice) || noticeEntries.length > 0;

  return (
    <div className="grid min-h-full place-items-center px-4 py-10 md:px-6">
      <div className="flex w-full max-w-xl min-w-0 flex-col items-center gap-4">
        <DraftStart
          activeFactory={activeFactory}
          configurationError={configurationError}
          missingDefaultModel={missingDefaultModel}
          missingCredential={missingCredential}
        />
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
      <Txt as="h1" variant="title" tone="ink" id="draft-start-heading" className="m-0 text-center">
        What do you want to work on?
      </Txt>
      {configurationError && (
        <Notice variant="destructive">Failed to load session configuration: {configurationError.message}</Notice>
      )}

      <div className="flex min-w-0 flex-col gap-2">
        {activeFactory && <ComposerPanel composerVariant="textarea" />}
        <FactoryContext activeFactory={activeFactory} />
      </div>
    </section>
  );
}

function missingCredentialDescription(guard: MissingCredentialGuard, anchor: ModelDefaultsAnchor): string {
  const providerName = providerDisplayName(guard.provider);
  const requirement = `The default model (${guard.modelId}) needs a credential for ${providerName}.`;
  if (anchor === MODEL_DEFAULTS_ANCHORS.factory) {
    return `${requirement} Ask an org admin to add one under ${MODEL_DEFAULTS_LABELS.factory} in Models settings.`;
  }
  return `${requirement} Add your own key for ${providerName} under ${MODEL_DEFAULTS_LABELS.personal} in Models settings.`;
}

function MissingCredentialState({ factoryId, guard }: { factoryId: string; guard: MissingCredentialGuard }) {
  const projectQuery = useFactoryProjectQuery(factoryId);
  const anchor = sessionDefaultsAnchor(projectQuery.data?.modelScope);
  return (
    <EmptyState
      as="h2"
      iconSlot={<Bot />}
      titleSlot={`You don't have access to ${providerDisplayName(guard.provider)}`}
      descriptionSlot={missingCredentialDescription(guard, anchor)}
      actionSlot={
        <Link to={settingsSectionPath(factoryId, 'models', anchor)} className={buttonVariants({ variant: 'primary' })}>
          Open Models settings
        </Link>
      }
    />
  );
}

function MissingDefaultModelState({ factoryId }: { factoryId: string }) {
  const projectQuery = useFactoryProjectQuery(factoryId);
  const anchor = sessionDefaultsAnchor(projectQuery.data?.modelScope);
  return (
    <EmptyState
      as="h2"
      iconSlot={<Bot />}
      titleSlot="No default model configured for this Factory"
      descriptionSlot="Connect a model provider and choose a default model in Models settings before starting a chat."
      actionSlot={
        <Link to={settingsSectionPath(factoryId, 'models', anchor)} className={buttonVariants({ variant: 'primary' })}>
          Open Models settings
        </Link>
      }
    />
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
    <div className="text-muted-foreground flex max-w-full items-center gap-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <FolderIcon size={13} className="text-placeholder shrink-0" />
        <Txt as="span" variant="column" title={activeFactory?.name} className="min-w-0 truncate">
          {activeFactory?.name ?? 'Factory'}
        </Txt>
        {projectPath && (
          <>
            <Txt as="span" variant="caption" tone="faint" className="shrink-0">
              ·
            </Txt>
            <Txt as="span" variant="caption" tone="faint" title={projectPath} className="min-w-0 truncate">
              {projectPath}
            </Txt>
          </>
        )}
      </div>
      {gitBranch && (
        <>
          <Txt as="span" variant="caption" tone="faint" aria-hidden className="shrink-0">
            ·
          </Txt>
          <div className="flex min-w-0 items-center gap-1.5">
            <GitBranch size={13} aria-hidden className="text-placeholder shrink-0" />
            <Txt as="span" variant="caption" title={gitBranch} className="min-w-0 truncate">
              {gitBranch}
            </Txt>
          </div>
        </>
      )}
    </div>
  );
}
