import { Button } from '@mastra/playground-ui/components/Button';
import { Link2 } from 'lucide-react';

import { useApiConfig } from '../../../../api/config';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { connectUserGithub } from '../../workspaces/services/github';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { SettingsIntegrationIcon } from './brand-icons/SettingsIntegrationIcon';

export function UserGithubConnectionRow() {
  const { baseUrl } = useApiConfig();
  const status = useGithubStatusQuery().data;

  if (!status || (!status.userConnected && status.installations.length === 0)) return null;

  if (status.userConnected) {
    return (
      <SettingsRow
        label={
          <span className="flex items-center gap-2">
            <SettingsIntegrationIcon provider="github" />
            GitHub
          </span>
        }
        description={status.userGithubUsername ? `@${status.userGithubUsername}` : 'Personal account connected'}
      />
    );
  }

  if (status.userConnected !== false) return null;

  return (
    <SettingsRow
      label={
        <span className="flex items-center gap-2">
          <SettingsIntegrationIcon provider="github" />
          GitHub
        </span>
      }
      description="Connect it so issues and PRs you create are authored as you."
    >
      <Button size="sm" icon={<Link2 />} onClick={() => connectUserGithub(baseUrl)}>
        Connect GitHub
      </Button>
    </SettingsRow>
  );
}
