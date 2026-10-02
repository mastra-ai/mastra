import { Brain } from 'lucide-react';
import { Link } from 'react-router';
import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';

import type { AvailableModelOption } from '../../../../hooks/useAvailableModels';
import { useProvidersQuery } from '../../../../hooks/use-providers';
import { useCustomProvidersQuery } from '../../../../hooks/use-custom-providers';
import { settingsSectionPath } from '../settingsSections';
import { SettingsSubsection } from './SettingsSubsection';
import { OMSection } from './OMSection';

interface MemorySettingsProps {
  scope: 'personal' | 'factory';
  factoryId: string | undefined;
  models: AvailableModelOption[];
  sessionResourceId: string | undefined;
  sessionScope: string | undefined;
}

export function MemorySettings({ scope, factoryId, models, sessionResourceId, sessionScope }: MemorySettingsProps) {
  const providersQuery = useProvidersQuery();
  const customProvidersQuery = useCustomProvidersQuery();
  const factoryView = scope === 'factory' && factoryId;
  const anyConnected =
    (providersQuery.data ?? []).some(p => p.source !== 'none') || (customProvidersQuery.data ?? []).length > 0;
  const providersKnown = providersQuery.isSuccess && customProvidersQuery.isSuccess;

  if (providersKnown && !anyConnected) {
    return (
      <EmptyState
        as="h2"
        iconSlot={<Brain />}
        titleSlot="No models configured"
        descriptionSlot="Observational memory needs a model to summarize and retain context. Connect a provider on the Models page first."
        actionSlot={
          factoryId ? (
            <Link
              to={settingsSectionPath(factoryId, scope === 'factory' ? 'models' : 'personal-models')}
              className={buttonVariants({ variant: 'primary' })}
            >
              Open Models settings
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <SettingsSubsection
      title="Observational memory"
      description={
        factoryView
          ? 'Models and token thresholds used to summarize and retain context in Factory runs.'
          : 'Models and token thresholds used to summarize and retain context in your interactive chats.'
      }
      scope={scope}
    >
      <SettingsContainer>
        {factoryView ? (
          <OMSection key="factory" factoryId={factoryId} models={models} />
        ) : (
          <OMSection key="personal" resourceId={sessionResourceId} scope={sessionScope} models={models} />
        )}
      </SettingsContainer>
    </SettingsSubsection>
  );
}
