import { IncidentioIntakeCard, incidentioCredentialActive } from '@mastra/playground-ui/domains/factory';
import type { UseQueryResult } from '@tanstack/react-query';
import { useFactoriesQuery } from '../../../../hooks/useFactories';
import { useIncidentioSourcesQuery } from '../../../../hooks/useIncidentioData';
import type { IncidentioStatus } from '../../factory/services/incidentio';
import type { PlatformProviderConnection } from '../../factory/services/platformConnect';
import { useIntakeSelection } from '../hooks/useIntakeSelection';
import type { IntakeSectionProps } from './IntakeProviderCard';
import { RoutedSourcePicker } from './IntakeSourceRouting';

export { isIncidentioDirectConfigured } from '@mastra/playground-ui/domains/factory';

export function IncidentioIntakeSection({
  config,
  listed,
  statusQuery,
  connectionsQuery,
}: IntakeSectionProps & {
  statusQuery: UseQueryResult<IncidentioStatus>;
  connectionsQuery: UseQueryResult<PlatformProviderConnection[]>;
}) {
  const selection = useIntakeSelection('incidentio');
  const factories = useFactoriesQuery().data ?? [];
  const sourcesQuery = useIncidentioSourcesQuery(incidentioCredentialActive(statusQuery.data, connectionsQuery.data));
  return (
    <IncidentioIntakeCard
      config={config}
      listed={listed}
      selection={selection}
      statusQuery={statusQuery}
      connectionsQuery={connectionsQuery}
      sourcesQuery={sourcesQuery}
      renderPicker={picker => <RoutedSourcePicker {...picker} factories={factories} />}
    />
  );
}
