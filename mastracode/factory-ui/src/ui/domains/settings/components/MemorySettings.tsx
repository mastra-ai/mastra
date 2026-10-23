import { Brain } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { Card, CardContent } from '@mastra/playground-ui/components/Card';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useAvailableModelsQuery } from '../../../../hooks/useAvailableModels';
import { useProviderConnectionState } from '../hooks/useProviderConnectionState';
import { settingsSectionPath } from '../settingsSections';
import { MemoryUsedBy } from './MemoryUsedBy';
import { IconTile } from './models/routing/IconTile';
import { MODEL_DEFAULTS_ICONS, MODEL_DEFAULTS_TONES } from './models/routing/model-routes';
import type { ModelDefaults } from './models/routing/model-routes';
import { SettingsSubsection } from './SettingsSubsection';
import { OMSection } from './OMSection';

export function MemorySettings({ factoryId, sessionId }: { factoryId: string; sessionId: string | undefined }) {
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
    <SettingsSubsection
      title="Observational memory"
      description="When a thread grows, the observer summarizes it and the reflector condenses those notes."
    >
      <div className="flex flex-col gap-3">
        <MemoryCard title="Personal memory" defaults="personal" factoryId={factoryId}>
          <PersonalOMSection sessionId={sessionId} />
        </MemoryCard>
        <MemoryCard title="Factory memory" defaults="factory" factoryId={factoryId}>
          <FactoryOMSection factoryId={factoryId} />
        </MemoryCard>
      </div>
    </SettingsSubsection>
  );
}

function PersonalOMSection({ sessionId }: { sessionId: string | undefined }) {
  const modelsQuery = useAvailableModelsQuery();
  return <OMSection sessionId={sessionId} models={modelsQuery.data ?? []} />;
}

function FactoryOMSection({ factoryId }: { factoryId: string }) {
  const modelsQuery = useAvailableModelsQuery({ factoryProjectId: factoryId });
  return <OMSection factoryId={factoryId} models={modelsQuery.data ?? []} />;
}

function MemoryCard({
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
    <Card as="section" aria-label={title}>
      <CardContent className="flex flex-col gap-4">
        <header className="flex flex-wrap items-center gap-3">
          <IconTile icon={MODEL_DEFAULTS_ICONS[defaults]} className={MODEL_DEFAULTS_TONES[defaults]} />
          <Txt as="h3" variant="label" className="flex-1">
            {title}
          </Txt>
          <MemoryUsedBy factoryId={factoryId} defaults={defaults} />
        </header>
        {children}
      </CardContent>
    </Card>
  );
}
