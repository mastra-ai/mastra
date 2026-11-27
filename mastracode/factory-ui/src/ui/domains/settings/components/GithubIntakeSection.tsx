import { GithubIntakeCard } from '@mastra/playground-ui/domains/factory';
import type { IntakeSectionProps } from '@mastra/playground-ui/domains/factory';
import type { UseQueryResult } from '@tanstack/react-query';
import { useFactoriesQuery } from '../../../../hooks/useFactories';
import type { GithubStatus } from '../../workspaces/services/github';
import { useIntakeSelection } from '../hooks/useIntakeSelection';
import { GithubConnectButton, GithubManageButton } from './GithubConnectionControls';

export function GithubIntakeSection({
  config,
  listed,
  statusQuery,
}: IntakeSectionProps & { statusQuery: UseQueryResult<GithubStatus> }) {
  const selection = useIntakeSelection('github');
  const dependabotSelection = useIntakeSelection('dependabot');
  const factoriesQuery = useFactoriesQuery();
  const slugs = [
    ...new Set(
      (factoriesQuery.data ?? []).flatMap(factory =>
        factory.repositories.filter(repository => repository.provider !== 'gitlab').map(repository => repository.slug),
      ),
    ),
  ];
  return (
    <GithubIntakeCard
      config={config}
      listed={listed}
      selection={selection}
      dependabotSelection={dependabotSelection}
      statusQuery={statusQuery}
      repositoriesQuery={{ ...factoriesQuery, data: factoriesQuery.data && slugs }}
      connectButton={<GithubConnectButton />}
      manageButton={<GithubManageButton />}
    />
  );
}
