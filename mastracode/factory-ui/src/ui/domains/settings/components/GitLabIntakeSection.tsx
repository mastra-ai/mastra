import { GitLabIntakeCard } from '@mastra/playground-ui/domains/factory';
import type { UseQueryResult } from '@tanstack/react-query';
import { useFactoriesQuery } from '../../../../hooks/useFactories';
import { useGitLabProjectsQuery } from '../../../../hooks/useGitLabData';
import type { GitLabStatus } from '../../factory/services/gitlab';
import { useIntakeSelection } from '../hooks/useIntakeSelection';
import type { IntakeSectionProps } from './IntakeProviderCard';
import { RoutedSourcePicker } from './IntakeSourceRouting';

export function GitLabIntakeSection({
  config,
  listed,
  statusQuery,
}: IntakeSectionProps & { statusQuery: UseQueryResult<GitLabStatus> }) {
  const selection = useIntakeSelection('gitlab');
  const factories = useFactoriesQuery().data ?? [];
  const status = statusQuery.data;
  const projectsQuery = useGitLabProjectsQuery(Boolean(status?.enabled && status.configured));
  return (
    <GitLabIntakeCard
      config={config}
      listed={listed}
      selection={selection}
      statusQuery={statusQuery}
      projectsQuery={projectsQuery}
      renderPicker={picker => <RoutedSourcePicker {...picker} factories={factories} />}
    />
  );
}
