import { SettingsContainer } from '@mastra/playground-ui/new/settings';
import { useParams } from 'react-router';

import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { ConnectedAccountsSection } from './ConnectedAccountsSection';
import { GithubPatBlock } from './GithubPatBlock';
import { McpClientsSection } from './McpClientsSection';
import { OrganizationConnectionsSection } from './OrganizationConnectionsSection';
import { SettingsSubsection } from './SettingsSubsection';
import { UserGithubConnectionRow } from './UserGithubConnectionRow';

export function ConnectionsSection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const githubStatus = useGithubStatusQuery().data;
  const githubRelevant =
    githubStatus?.connected ||
    githubStatus?.userConnected ||
    factoryQuery.data?.repositories.some(repository => repository.provider !== 'gitlab');

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <SettingsSubsection scope="personal" title="Connected accounts">
        <SettingsContainer>
          <UserGithubConnectionRow />
          <ConnectedAccountsSection />
        </SettingsContainer>
      </SettingsSubsection>
      <OrganizationConnectionsSection />
      {githubRelevant && <GithubPatBlock />}
      <McpClientsSection />
    </div>
  );
}
