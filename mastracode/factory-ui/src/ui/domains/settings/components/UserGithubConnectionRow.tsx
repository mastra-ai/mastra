import { Button } from '@mastra/playground-ui/components/Button';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';

import { useApiConfig } from '../../../../api/config';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { connectUserGithub } from '../../workspaces/services/github';
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
import { SettingsCard } from './SettingsCard';
import { SettingsSubsection } from './SettingsSubsection';

/**
 * Personal GitHub authorization for Settings › Repositories.
 *
 * The org-level GitHub App installation makes repositories reachable, but
 * issues/PRs the user originates are authored by the App bot until the user
 * personally authorizes the App. This offers that authorization, or shows the
 * linked GitHub identity once connected.
 *
 * Renders nothing while status loads, when no installation exists yet, or when
 * the server predates per-user connections (`userConnected` absent).
 */
export function UserGithubConnectionRow() {
  const { baseUrl } = useApiConfig();
  const status = useGithubStatusQuery().data;

  if (!status || status.installations.length === 0) return undefined;

  if (status.userConnected) {
    return (
      <SettingsSubsection title="GitHub account">
        <SettingsCard>
          <SettingsRow
            variant="factory"
            label={
              <span className="flex items-center gap-2">
                <GithubIcon className="text-icon3 size-4 shrink-0" />
                {`@${status.userGithubUsername ?? 'unknown'}`}
              </span>
            }
            description="Issues and PRs you create are authored as you."
          />
        </SettingsCard>
      </SettingsSubsection>
    );
  }

  if (status.userConnected !== false) return undefined;

  return (
    <SettingsSubsection title="GitHub account">
      <SettingsCard>
        <SettingsRow
          variant="factory"
          label="Not connected"
          description="Connect it so issues and PRs you create are authored as you."
        >
          <Button size="xs" variant="outline" onClick={() => connectUserGithub(baseUrl)}>
            <GithubIcon className="size-3.5" />
            Connect GitHub
          </Button>
        </SettingsRow>
      </SettingsCard>
    </SettingsSubsection>
  );
}
