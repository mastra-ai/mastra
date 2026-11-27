import { JiraIntakeCard } from '@mastra/playground-ui/domains/factory';
import type { UseQueryResult } from '@tanstack/react-query';
import { useFactoriesQuery } from '../../../../hooks/useFactories';
import { useJiraProjectsQuery } from '../../../../hooks/useJiraData';
import type { JiraStatus } from '../../factory/services/jira';
import { useIntakeSelection } from '../hooks/useIntakeSelection';
import type { IntakeSectionProps } from './IntakeProviderCard';
import { JiraRoutedSourcePicker } from './jira/JiraRoutedSourcePicker';

export function JiraIntakeSection({
  config,
  listed,
  statusQuery,
}: IntakeSectionProps & { statusQuery: UseQueryResult<JiraStatus> }) {
  const selection = useIntakeSelection('jira');
  const factories = useFactoriesQuery().data ?? [];
  const status = statusQuery.data;
  const projectsQuery = useJiraProjectsQuery(Boolean(status?.enabled && status.configured));
  return (
    <JiraIntakeCard
      config={config}
      listed={listed}
      selection={selection}
      statusQuery={statusQuery}
      projectsQuery={projectsQuery}
      renderPicker={({ integrationId: _integrationId, routingLabel: _routingLabel, ...picker }) => (
        <JiraRoutedSourcePicker {...picker} factories={factories} />
      )}
    />
  );
}
