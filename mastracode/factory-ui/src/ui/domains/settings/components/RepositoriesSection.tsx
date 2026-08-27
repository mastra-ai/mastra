import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { useParams } from 'react-router';

import { useApiConfig } from '../../../../api/config';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { ConnectRepositoriesPanel } from '../../workspaces';
import { manageGithubConnection } from '../../workspaces/services/github';
import { GithubPatBlock } from './GithubPatBlock';
import { FactorySetupSection } from './FactorySetupSection';
import { SettingsCard } from './SettingsCard';
import { SettingsSubsection } from './SettingsSubsection';
import { UserGithubConnectionRow } from './UserGithubConnectionRow';

export function RepositoriesSection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const { baseUrl } = useApiConfig();
  const factoryQuery = useFactoryQuery(factoryId);
  const githubConnected = useGithubStatusQuery().data?.connected === true;
  const activeFactory = factoryQuery.data;

  if (!activeFactory) {
    return <Notice variant="info">Select a factory to manage its repositories.</Notice>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <SettingsSubsection
        title="Repositories"
        description={`Repositories ${activeFactory.name} can edit. What feeds the board is set under Work Intake.`}
        action={
          // Granting repo access happens on GitHub — stays reachable even when nothing is linked yet.
          githubConnected && (
            <Button variant="outline" size="sm" onClick={() => manageGithubConnection(baseUrl)}>
              Manage GitHub connection
            </Button>
          )
        }
      >
        <SettingsCard>
          <ConnectRepositoriesPanel factory={activeFactory} />
        </SettingsCard>
      </SettingsSubsection>

      <FactorySetupSection factory={activeFactory} />

      <UserGithubConnectionRow />

      <GithubPatBlock />
    </div>
  );
}
