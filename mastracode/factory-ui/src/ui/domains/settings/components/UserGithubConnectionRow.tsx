import { Button } from '@mastra/playground-ui/components/Button';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';

import { useApiConfig } from '../../../../api/config';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { connectUserGithub } from '../../workspaces/services/github';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';

import { SettingsSubsection } from './SettingsSubsection';

export function UserGithubConnectionRow() {
  const { baseUrl } = useApiConfig();
  const status = useGithubStatusQuery().data;

  if (!status || status.installations.length === 0) return undefined;

  if (status.userConnected) {
    return (
      <SettingsSubsection scope="personal" title="GitHub account">
        <SettingsContainer>
          <SettingsRow
            label={
              <span className="flex items-center gap-2">
                <GithubIcon className="text-icon3 size-4 shrink-0" />
                {`@${status.userGithubUsername ?? 'unknown'}`}
              </span>
            }
            description="Issues and PRs you create are authored as you."
          />
        </SettingsContainer>
      </SettingsSubsection>
    );
  }

  if (status.userConnected !== false) return undefined;

  return (
    <SettingsSubsection scope="personal" title="GitHub account">
      <SettingsContainer>
        <SettingsRow label="Not connected" description="Connect it so issues and PRs you create are authored as you.">
          <Button size="xs" variant="outline" onClick={() => connectUserGithub(baseUrl)}>
            <GithubIcon className="size-3.5" />
            Connect GitHub
          </Button>
        </SettingsRow>
      </SettingsContainer>
    </SettingsSubsection>
  );
}
