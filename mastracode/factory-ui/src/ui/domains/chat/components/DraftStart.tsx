import { providerDisplayName } from '@mastra/factory/provider-display-name';
import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconRobot } from '@mastra/playground-ui/icons/central/IconRobot';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';

import { traySurface } from '../../../ui/tray';
import { MODEL_DEFAULTS_LABELS } from '../../settings/components/models/routing/model-routes';
import { MODEL_DEFAULTS_ANCHORS, settingsSectionPath } from '../../settings/settingsSections';
import type { ModelDefaultsAnchor } from '../../settings/settingsSections';
import { useChatTranscript } from '../context/useChatTranscript';
import type { DraftModelGuards, MissingCredentialGuard } from '../hooks/useDraftModelGuards';
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts';
import { ComposerPanel } from './ComposerPanel';
import { TranscriptEntries } from './Transcript';

const draftStartClass = 'flex min-w-0 w-full flex-col items-stretch gap-6';

export const draftPageClass = 'mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-10 px-4 pt-[14vh] pb-16 md:px-6';

export function DraftStart({
  heading,
  guards,
  starters,
  children,
}: {
  heading: ReactNode;
  guards: DraftModelGuards;
  starters?: ReactNode;
  children?: ReactNode;
}) {
  useGlobalShortcuts();
  const { transcript } = useChatTranscript();
  const location = useLocation();
  const routeErrorNotice = readRouteErrorNotice(location.state);
  const noticeEntries = transcript.entries.filter(entry => entry.kind === 'notice');
  const hasNotices = Boolean(routeErrorNotice) || noticeEntries.length > 0;

  return (
    <div className={draftPageClass}>
      <div className="flex w-full min-w-0 flex-col items-center gap-4">
        <DraftComposer heading={heading} guards={guards} starters={starters} />
        {hasNotices && (
          <div className="flex w-full flex-col gap-4">
            {routeErrorNotice && <Notice variant="destructive">{routeErrorNotice}</Notice>}
            <TranscriptEntries entries={noticeEntries} onApprove={() => undefined} onRespond={() => undefined} />
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function readRouteErrorNotice(state: unknown): string | undefined {
  if (typeof state !== 'object' || state === null || !('routeErrorNotice' in state)) return undefined;
  const { routeErrorNotice } = state;
  return typeof routeErrorNotice === 'string' ? routeErrorNotice : undefined;
}

export function ConfigurationErrorNotice({ error }: { error: Error }) {
  return <Notice variant="destructive">Failed to load session configuration: {error.message}</Notice>;
}

function DraftComposer({
  heading,
  guards: { activeFactory, defaultsAnchor, missingModel, missingCredential, configurationError },
  starters,
}: {
  heading: ReactNode;
  guards: DraftModelGuards;
  starters: ReactNode;
}) {
  if (activeFactory && missingModel) {
    return (
      <section className={draftStartClass} aria-label="Model setup required">
        <MissingModelState factoryId={activeFactory.id} anchor={defaultsAnchor} />
      </section>
    );
  }

  if (activeFactory && missingCredential) {
    return (
      <section className={draftStartClass} aria-label="Provider credential required">
        <MissingCredentialState factoryId={activeFactory.id} anchor={defaultsAnchor} guard={missingCredential} />
      </section>
    );
  }

  return (
    <section className={draftStartClass} aria-labelledby="draft-start-heading">
      <Txt as="h2" variant="title" tone="ink" id="draft-start-heading" className="m-0">
        {heading}
      </Txt>
      {configurationError && <ConfigurationErrorNotice error={configurationError} />}

      {activeFactory && (
        <div className={cn(traySurface, 'flex flex-col gap-1.5 p-1.5')}>
          <ComposerPanel composerVariant="textarea" />
          {starters}
        </div>
      )}
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

function MissingCredentialState({
  factoryId,
  anchor,
  guard,
}: {
  factoryId: string;
  anchor: ModelDefaultsAnchor;
  guard: MissingCredentialGuard;
}) {
  return (
    <EmptyState
      as="h2"
      iconSlot={<IconRobot />}
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

function MissingModelState({ factoryId, anchor }: { factoryId: string; anchor: ModelDefaultsAnchor }) {
  return (
    <EmptyState
      as="h2"
      iconSlot={<IconRobot />}
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
