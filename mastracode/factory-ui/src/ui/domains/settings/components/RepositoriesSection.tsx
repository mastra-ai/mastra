import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';
import { useParams } from 'react-router';

import { useApiConfig } from '../../../../api/config';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { useGitLabStatusQuery } from '../../../../hooks/useGitLabData';
import { MASTRA_PROJECTS_URL } from '../../factory/services/gitlab';
import { ConnectRepositoriesPanel } from '../../workspaces';
import { manageGithubConnection } from '../../workspaces/services/github';
import { FactorySetupSection } from './FactorySetupSection';
import { GithubPatBlock } from './GithubPatBlock';
import { SettingsSubsection } from './SettingsSubsection';
import { UserGithubConnectionRow } from './UserGithubConnectionRow';

export function RepositoriesSection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const { baseUrl } = useApiConfig();
  const factoryQuery = useFactoryQuery(factoryId);
  const githubConnected = useGithubStatusQuery().data?.connected === true;
  const gitlabStatus = useGitLabStatusQuery().data;
  const activeFactory = factoryQuery.data;

  if (!activeFactory) {
    return <Notice variant="info">Select a factory to manage its repositories.</Notice>;
  }

  const showGithubSettings = githubConnected || activeFactory.repositories.some(repo => repo.provider !== 'gitlab');

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <SettingsSubsection
        scope="factory"
        title="Repositories"
        description={`Repositories ${activeFactory.name} can edit. What feeds the board is set under Work Intake.`}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {githubConnected && (
              <Button variant="outline" size="sm" onClick={() => manageGithubConnection(baseUrl)}>
                Manage GitHub connection
              </Button>
            )}
            {gitlabStatus?.mode === 'platform' && (
              <Button as="a" href={MASTRA_PROJECTS_URL} target="_blank" variant="outline" size="sm">
                {gitlabStatus.reauthRequired
                  ? 'Reconnect GitLab'
                  : gitlabStatus.configured
                    ? 'Manage GitLab connection'
                    : 'Connect GitLab'}
              </Button>
            )}
            {gitlabStatus?.configured && gitlabStatus.mode === 'direct' && (
              <span className="text-meta text-icon3">GitLab managed by deployment environment variables</span>
            )}
          </div>
        }
      >
        <SettingsContainer>
          <ConnectRepositoriesPanel factory={activeFactory} />
        </SettingsContainer>
      </SettingsSubsection>

      <FactorySetupSection factory={activeFactory} />

      {showGithubSettings && (
        <>
          <UserGithubConnectionRow />

          <GithubPatBlock />
        </>
      )}
    </div>
  );
}
