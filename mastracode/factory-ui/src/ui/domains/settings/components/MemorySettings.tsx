import { Brain } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { SettingsContainer, SettingsGroup, SettingsTitle } from '@mastra/playground-ui/new/settings';

import { useAvailableModelsQuery } from '../../../../hooks/useAvailableModels';
import { useProviderConnectionState } from '../hooks/useProviderConnectionState';
import { settingsSectionPath } from '../settingsSections';
import { MemoryUsedBy } from './MemoryUsedBy';
import type { ModelDefaults } from './models/routing/model-routes';
import { OMSection } from './OMSection';

export function MemorySettings({
  factoryId,
  sessionId,
  threadId,
  resourceId,
}: {
  factoryId: string;
  sessionId: string | undefined;
  threadId?: string;
  resourceId?: string;
}) {
  const { anyConnected, providersKnown } = useProviderConnectionState();

  if (providersKnown && !anyConnected) {
    return (
      <EmptyState
        as="h2"
        iconSlot={<Brain />}
        titleSlot="No models configured"
        descriptionSlot="Observational memory needs a model to summarize and retain context. Connect a provider on the Models page first."
        actionSlot={
          <Link to={settingsSectionPath(factoryId, 'models')} className={buttonVariants({ variant: 'primary' })}>
            Open Models settings
          </Link>
        }
      />
    );
  }

  return (
    <>
      <MemoryGroup title="Personal memory" defaults="personal" factoryId={factoryId}>
        <PersonalOMSection sessionId={sessionId} threadId={threadId} resourceId={resourceId} />
      </MemoryGroup>
      <MemoryGroup title="Factory memory" defaults="factory" factoryId={factoryId}>
        <FactoryOMSection factoryId={factoryId} />
      </MemoryGroup>
    </>
  );
}

function PersonalOMSection({
  sessionId,
  threadId,
  resourceId,
}: {
  sessionId: string | undefined;
  threadId: string | undefined;
  resourceId: string | undefined;
}) {
  const modelsQuery = useAvailableModelsQuery();
  return (
    <OMSection sessionId={sessionId} threadId={threadId} resourceId={resourceId} models={modelsQuery.data ?? []} />
  );
}

function FactoryOMSection({ factoryId }: { factoryId: string }) {
  const modelsQuery = useAvailableModelsQuery({ factoryProjectId: factoryId });
  return <OMSection factoryId={factoryId} models={modelsQuery.data ?? []} />;
}

const OM_DESCRIPTION =
  'Observational memory: when a thread grows, the observer summarizes it and the reflector condenses those notes.';

function MemoryGroup({
  title,
  defaults,
  factoryId,
  children,
}: {
  title: string;
  defaults: ModelDefaults;
  factoryId: string;
  children: ReactNode;
}) {
  return (
    <SettingsGroup>
      <SettingsTitle info={OM_DESCRIPTION} accessory={<MemoryUsedBy factoryId={factoryId} defaults={defaults} />}>
        {title}
      </SettingsTitle>
      <SettingsContainer>{children}</SettingsContainer>
    </SettingsGroup>
  );
}
