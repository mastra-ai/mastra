import { Button } from '@mastra/playground-ui/components/Button';
import { Link2 } from 'lucide-react';

import { useApiConfig } from '../../../../api/config';
import { connectGithub, manageGithubConnection } from '../../workspaces/services/github';
import { ConnectionManagementButton } from './common/ConnectionManagementButton';

export function GithubConnectButton() {
  const { baseUrl } = useApiConfig();
  return (
    <Button size="sm" icon={<Link2 />} aria-label="Connect GitHub" onClick={() => connectGithub(baseUrl)}>
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
