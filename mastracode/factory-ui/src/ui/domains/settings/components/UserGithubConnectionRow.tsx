import { Button } from '@mastra/playground-ui/components/Button';
import { IconChainLink1 } from '@mastra/playground-ui/icons/central/IconChainLink1';

import { useApiConfig } from '../../../../api/config';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { connectUserGithub } from '../../workspaces/services/github';
import { IntegrationItem } from './IntegrationItem';

export function UserGithubConnectionRow() {
  const { baseUrl } = useApiConfig();
  const status = useGithubStatusQuery().data;

  if (!status || status.installations.length === 0) return undefined;

  if (status.userConnected) {
    return (
      <IntegrationItem provider="github" name="GitHub" description={`@${status.userGithubUsername ?? 'unknown'}`} />
    );
  }

  if (status.userConnected !== false) return undefined;

  return (
    <IntegrationItem
      provider="github"
      name="GitHub"
      description="Connect it so issues and PRs you create are authored as you."
    >
      <Button size="sm" icon={<IconChainLink1 />} onClick={() => connectUserGithub(baseUrl)}>
        Connect GitHub
      </Button>
    </IntegrationItem>
  );
}
