import { Radar } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { useEntityLearningProgress, useThemeEntities } from '../hooks';
import { SankeySignals } from '../sankey-signals';
import { orderedSignals } from '../signal-formatting';
import { SignalsErrorState } from '../signals-error-state';
import { SignalsLoadingSkeleton } from '../signals-loading-skeleton';
import { TraceIntelligenceProvider } from '../trace-intelligence-provider';
import { useTraceIntelligence } from '../use-trace-intelligence';
import { SignalsOverviewPage as SignalsEmptyState } from './signals-overview-page';
import { EmptyState } from '@/ds/components/EmptyState';
import { NoDataPageLayout } from '@/ds/components/PageLayout';

export interface TraceIntelligenceEntityDetailProps {
  entityId: string;
  entityType: string;
  dateFrom?: Date;
  dateTo?: Date;
  dateRangePicker?: ReactNode;
}

export function TraceIntelligenceEntityDetail({
  entityId,
  entityType,
  dateFrom,
  dateTo,
  dateRangePicker,
}: TraceIntelligenceEntityDetailProps) {
  const [selectedThemeId, setSelectedThemeId] = useState<string>();
  const context = useTraceIntelligence();
  const entitiesQuery = useThemeEntities(entityType);
  const entity = entitiesQuery.data?.entities.find(
    candidate => candidate.entityType === entityType && candidate.entityId === entityId,
  );
  const signalCatalog = entity?.signalCatalog ?? context.signalCatalog;
  const signalNames = entity ? orderedSignals(signalCatalog, entity.availableSignals) : [];
  const progressQuery = useEntityLearningProgress(
    entityId,
    entityType,
    !entitiesQuery.isPending && !entitiesQuery.isError && entity !== undefined && signalNames.length < 2,
  );

  if (entitiesQuery.isPending) return <SignalsLoadingSkeleton />;
  if (entitiesQuery.isError) {
    return (
      <SignalsErrorState message="Unable to load trace signal entity." onRetry={() => void entitiesQuery.refetch()} />
    );
  }
  if (!entity) {
    return (
      <NoDataPageLayout>
        <EmptyState
          iconSlot={<Radar aria-hidden="true" />}
          titleSlot="Trace Intelligence entity not found"
          descriptionSlot="The requested entity is unavailable in this project."
        />
      </NoDataPageLayout>
    );
  }

  return (
    <TraceIntelligenceProvider
      cacheScope={context.cacheScope}
      request={context.request}
      LinkComponent={context.LinkComponent}
      getTraceHref={context.getTraceHref}
      signalCatalog={signalCatalog}
      signalManagement={context.signalManagement}
    >
      {signalNames.length < 2 ? (
        <SignalsEmptyState LinkComponent={context.LinkComponent} progress={progressQuery.data} />
      ) : (
        <SankeySignals
          key={`${entity.entityId}:${signalNames.join(',')}`}
          entityId={entity.entityId}
          entityType={entity.entityType}
          signalNames={signalNames}
          dateFrom={dateFrom}
          dateTo={dateTo}
          selectedThemeId={selectedThemeId}
          onSelectedThemeIdChange={setSelectedThemeId}
          dateRangePicker={dateRangePicker}
        />
      )}
    </TraceIntelligenceProvider>
  );
}
