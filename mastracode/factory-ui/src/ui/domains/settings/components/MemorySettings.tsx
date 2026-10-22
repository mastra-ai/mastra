import { Brain } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { Card, CardContent } from '@mastra/playground-ui/components/Card';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';

import { useAvailableModelsQuery } from '../../../../hooks/useAvailableModels';
import { useProviderConnectionState } from '../hooks/useProviderConnectionState';
import { settingsSectionPath } from '../settingsSections';
import { IconTile } from './models/routing/IconTile';
import {
  MODEL_DEFAULTS_ICONS,
  MODEL_DEFAULTS_TONES,
  MODEL_LANE_ICONS,
  MODEL_LANE_LABELS,
} from './models/routing/model-routes';
import type { ModelDefaults, ModelLane } from './models/routing/model-routes';
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
        <MemoryCard title="Personal memory" defaults="personal" usedBy="chats">
          <PersonalOMSection sessionId={sessionId} />
        </MemoryCard>
        <MemoryCard title="Factory memory" defaults="factory" usedBy="runs">
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
  usedBy,
  children,
}: {
  title: string;
  defaults: ModelDefaults;
  usedBy: ModelLane;
  children: ReactNode;
}) {
  const tone = MODEL_DEFAULTS_TONES[defaults];
  const UsedByIcon = MODEL_LANE_ICONS[usedBy];
  return (
    <Card as="section" aria-label={title}>
      <CardContent className="flex flex-col gap-4">
        <header className="flex flex-wrap items-center gap-3">
          <IconTile icon={MODEL_DEFAULTS_ICONS[defaults]} className={tone} />
          <Txt as="h3" variant="label" className="flex-1">
            {title}
          </Txt>
          <Txt as="span" variant="meta" tone="muted" className="flex items-center gap-2">
            Used by{' '}
            <span className="bg-fill-subtle text-foreground inline-flex h-6 items-center gap-1.5 rounded-md px-2">
              <UsedByIcon className={cn('size-3.5', tone)} aria-hidden="true" />
              {MODEL_LANE_LABELS[usedBy]}
            </span>
          </Txt>
        </header>
        {children}
      </CardContent>
    </Card>
  );
}
