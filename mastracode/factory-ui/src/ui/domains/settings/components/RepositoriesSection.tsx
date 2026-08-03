import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { useParams } from 'react-router';

import { useApiConfig } from '../../../../api/config';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { ConnectRepositoriesPanel } from '../../workspaces';
import type { BrokenGithubInstallation } from '../../workspaces/services/github';
import { manageGithubConnection } from '../../workspaces/services/github';
import { GithubPatBlock } from './GithubPatBlock';
import { FactorySetupSection } from './FactorySetupSection';
import { SettingsCard, SettingsRow } from './SettingsCard';
import { SettingsSubsection } from './SettingsSubsection';
import { UserGithubConnectionRow } from './UserGithubConnectionRow';

function BrokenInstallationRow({ installation, baseUrl }: { installation: BrokenGithubInstallation; baseUrl: string }) {
  return (
    <SettingsRow
      label={`@${installation.accountLogin ?? 'unknown'} — installation removed`}
      hint="Reconnect GitHub to restore repository access and intake."
    >
      <Button size="xs" onClick={() => manageGithubConnection(baseUrl)}>
        Reconnect
      </Button>
    </SettingsRow>
  );
}

export function RepositoriesSection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const { baseUrl } = useApiConfig();
  const factoryQuery = useFactoryQuery(factoryId);
  const githubStatus = useGithubStatusQuery().data;
  const githubConnected = githubStatus?.connected === true;
  const brokenInstallations = githubStatus?.brokenInstallations ?? [];
  const activeFactory = factoryQuery.data;

  if (!activeFactory) {
    return <Notice variant="info">Select a factory to manage its repositories.</Notice>;
  }

  return (
    <div className="flex flex-col gap-8">
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
        {brokenInstallations.length > 0 && (
          <SettingsCard>
            {brokenInstallations.map(installation => (
              <BrokenInstallationRow
                key={installation.installationId}
                installation={installation}
                baseUrl={baseUrl}
              />
            ))}
          </SettingsCard>
        )}
        <SettingsCard className="p-4">
          <ConnectRepositoriesPanel factory={activeFactory} />
        </SettingsCard>
      </SettingsSubsection>

      <FactorySetupSection factory={activeFactory} />

      <UserGithubConnectionRow />

      <GithubPatBlock />
    </div>
  );
}
