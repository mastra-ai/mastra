import { Button } from '@mastra/playground-ui/components/Button';
import { useApiConfig } from '../../../../api/config';
import { connectGithub, manageGithubConnection } from '../../workspaces/services/github';
import { ConnectionManagementButton } from './common/ConnectionManagementButton';
import { IconChainLink1 } from '@mastra/playground-ui/icons/central/IconChainLink1';

export function GithubConnectButton() {
  const { baseUrl } = useApiConfig();
  return (
    <Button size="sm" icon={<IconChainLink1 />} aria-label="Connect GitHub" onClick={() => connectGithub(baseUrl)}>
      Connect
    </Button>
  );
}

export function GithubManageButton() {
  const { baseUrl } = useApiConfig();
  return (
    <ConnectionManagementButton aria-label="Manage GitHub connection" onClick={() => manageGithubConnection(baseUrl)}>
      Manage
    </ConnectionManagementButton>
  );
}
