import { Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Bot } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';

import { useFactoryQuery } from '../../hooks/useFactories';
import { useFactoryAuth } from '../../hooks/useFactoryAuth';
import { useFactoryProjectQuery } from '../../hooks/useFactoryDefaultModel';
import { useDefaultModelQuery } from '../../hooks/use-default-model';
import { useFallbackModelQuery } from '../../hooks/useAvailableModels';
import { useProvidersQuery } from '../../hooks/use-providers';
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
import { StarterPrompts } from '../domains/chat/components/StarterPrompts';
import { TranscriptEntries } from '../domains/chat/components/Transcript';
import { newChatCatalogTarget, routedDefaultModelId } from '../domains/chat/context/chatDefaultModel';
import { ChatSessionBoundary } from '../domains/chat/context/ChatSessionProvider';
import { useChatTranscript } from '../domains/chat/context/useChatTranscript';
import { useGlobalShortcuts } from '../domains/chat/hooks/useGlobalShortcuts';
import { InFlight } from '../domains/factory/components/InFlight';
import { Txt } from '@mastra/playground-ui/components/Txt';

const draftStartClass = 'flex min-w-0 w-full flex-col items-stretch gap-6';

export function NewPage() {
  const { factoryId, draftSessionId } = useParams<{ factoryId: string; draftSessionId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const activeFactory = factoryQuery.data;
  const projectQuery = useFactoryProjectQuery(activeFactory?.id);
  const personalDefaultQuery = useDefaultModelQuery();
  const providersQuery = useProvidersQuery();
  const routedToFactory = projectQuery.data?.modelScope === 'factory';
  const chosenModelId = routedDefaultModelId(projectQuery.data?.modelScope, {
    factory: projectQuery.data?.defaultModelId,
    personal: personalDefaultQuery.data?.modelId,
  });
  const fallbackModelQuery = useFallbackModelQuery({
    ...newChatCatalogTarget(routedToFactory ? 'factory' : 'user', activeFactory?.id),
    enabled: projectQuery.isSuccess,
  });
  const chatModelId = chosenModelId ?? fallbackModelQuery.data;
  const chatModelSettled =
    Boolean(activeFactory) &&
    projectQuery.isSuccess &&
    (routedToFactory || personalDefaultQuery.isSuccess) &&
    (Boolean(chosenModelId) || fallbackModelQuery.isSuccess);
  const missingModel = chatModelSettled && !chatModelId;
  const chatModelProvider = chatModelId
    ? providersQuery.data?.find(entry => entry.provider === chatModelId.split('/')[0])
    : undefined;
  const chatCredentialScope = routedToFactory ? 'org' : 'user';
  const missingCredential =
    chatModelSettled && chatModelId && chatModelProvider && !isConnectedAt(chatModelProvider, chatCredentialScope)
      ? { modelId: chatModelId, provider: chatModelProvider.provider }
      : undefined;
  const configurationError =
    projectQuery.error ??
    (routedToFactory ? null : personalDefaultQuery.error) ??
    (chosenModelId ? null : fallbackModelQuery.error) ??
    providersQuery.error ??
    undefined;

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
          userDraft={draftSessionId !== undefined}
          missingModel={missingModel}
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
  userDraft,
  missingModel,
  missingCredential,
  configurationError,
}: {
  activeFactory: FactoryProject | undefined;
  userDraft: boolean;
  missingModel: boolean;
  missingCredential: MissingCredentialGuard | undefined;
  configurationError: Error | undefined;
}) {
  useGlobalShortcuts();
  const { transcript } = useChatTranscript();
  const location = useLocation();
  const routeErrorNotice = readRouteErrorNotice(location.state);
  const noticeEntries = transcript.entries.filter(entry => entry.kind === 'notice');
  const hasNotices = Boolean(routeErrorNotice) || noticeEntries.length > 0;
  const startsFromPrompt = userDraft && activeFactory && !missingModel && !missingCredential;

  return (
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-10 px-4 pt-[14vh] pb-16 md:px-6">
      <div className="flex w-full min-w-0 flex-col items-center gap-4">
        <DraftStart
          activeFactory={activeFactory}
          configurationError={configurationError}
          missingModel={missingModel}
          missingCredential={missingCredential}
        />
        {hasNotices && (
          <div className="flex w-full flex-col gap-4">
            {routeErrorNotice && <Notice variant="destructive">{routeErrorNotice}</Notice>}
            <TranscriptEntries entries={noticeEntries} onApprove={() => undefined} onRespond={() => undefined} />
          </div>
        )}
      </div>
      {startsFromPrompt && (
        <>
          <StarterPrompts factoryId={activeFactory.id} />
          <InFlight factoryId={activeFactory.id} />
        </>
      )}
    </div>
  );
}

function DraftStart({
  activeFactory,
  configurationError,
  missingModel,
  missingCredential,
}: {
  activeFactory: FactoryProject | undefined;
  configurationError: Error | undefined;
  missingModel: boolean;
  missingCredential: MissingCredentialGuard | undefined;
}) {
  const firstName = useFactoryAuth().data?.user?.name?.trim().split(/\s+/)[0];

  if (activeFactory && missingModel) {
    return (
      <section className={draftStartClass} aria-label="Model setup required">
        <MissingModelState factoryId={activeFactory.id} />
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
      <Txt as="h1" variant="title" tone="ink" id="draft-start-heading" className="m-0">
        {firstName ? `What should we ship, ${firstName}?` : 'What should we ship?'}
      </Txt>
      {configurationError && (
        <Notice variant="destructive">Failed to load session configuration: {configurationError.message}</Notice>
      )}

      {activeFactory && <ComposerPanel composerVariant="textarea" />}
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

function MissingModelState({ factoryId }: { factoryId: string }) {
  const projectQuery = useFactoryProjectQuery(factoryId);
  const anchor = sessionDefaultsAnchor(projectQuery.data?.modelScope);
  return (
    <EmptyState
      as="h2"
      iconSlot={<Bot />}
      titleSlot="No model available"
      descriptionSlot={
        anchor === MODEL_DEFAULTS_ANCHORS.factory
          ? `Chats in this Factory run on the organization's keys. Ask an org admin to connect a provider or choose a model under ${MODEL_DEFAULTS_LABELS.factory} in Models settings.`
          : `Chats in this Factory run on your own keys. Connect a provider or choose a model under ${MODEL_DEFAULTS_LABELS.personal} in Models settings.`
      }
      actionSlot={
        <Link to={settingsSectionPath(factoryId, 'models', anchor)} className={buttonVariants({ variant: 'primary' })}>
          Open Models settings
        </Link>
      }
    />
  );
}
