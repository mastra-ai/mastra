import { Brain, Building2, CircleUserRound, MessagesSquare, SquareKanban } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
        <MemoryCard
          title="Personal memory"
          icon={CircleUserRound}
          tone="text-chart-purple"
          usedBy="Chats"
          usedByIcon={MessagesSquare}
        >
          <PersonalOMSection sessionId={sessionId} />
        </MemoryCard>
        <MemoryCard
          title="Factory memory"
          icon={Building2}
          tone="text-chart-blue"
          usedBy="Work-item runs"
          usedByIcon={SquareKanban}
        >
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
  icon: Icon,
  tone,
  usedBy,
  usedByIcon: UsedByIcon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  tone: string;
  usedBy: string;
  usedByIcon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Card as="section" aria-label={title}>
      <CardContent className="flex flex-col gap-4">
        <header className="flex flex-wrap items-center gap-3">
          <span className={cn('bg-fill-subtle flex size-8 shrink-0 items-center justify-center rounded-lg', tone)}>
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <Txt as="h3" variant="label" className="flex-1">
            {title}
          </Txt>
          <Txt as="span" variant="meta" tone="muted" className="flex items-center gap-2">
            Used by{' '}
            <span className="bg-fill-subtle text-foreground inline-flex h-6 items-center gap-1.5 rounded-md px-2">
              <UsedByIcon className={cn('size-3.5', tone)} aria-hidden="true" />
              {usedBy}
            </span>
          </Txt>
        </header>
        {children}
      </CardContent>
    </Card>
  );
}
