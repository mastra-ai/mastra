import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useApiConfig } from '../../../../../shared/api/config';
import { useGithubStatusQuery } from '../../../../../shared/hooks/useGithubStatus';
import { GithubIcon } from '../../../ui/icons';
import { connectUserGithub } from '../../workspaces/services/github';

/**
 * Personal GitHub authorization row for Settings › Source Control.
 *
 * The org-level GitHub App installation makes repositories reachable, but
 * issues/PRs the user originates are authored by the App bot until the user
 * personally authorizes the App. This row offers that authorization, or shows
 * the linked GitHub identity once connected.
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
      <div className="flex items-center gap-2 border-t border-border1 pt-4">
        <GithubIcon size={16} className="shrink-0 text-icon3" />
        <Txt variant="ui-sm">
          Connected as <span className="font-medium text-icon6">@{status.userGithubUsername ?? 'unknown'}</span> — issues
          and PRs you create are authored as you.
        </Txt>
      </div>
    );
  }

  if (status.userConnected !== false) return undefined;

  return (
    <div className="flex items-center justify-between gap-4 border-t border-border1 pt-4">
      <Txt variant="ui-sm" className="min-w-0">
        Connect your GitHub account so issues and PRs you create are authored as you.
      </Txt>
      <Button size="xs" variant="outline" onClick={() => connectUserGithub(baseUrl)}>
        <GithubIcon size={14} />
        Connect GitHub
      </Button>
    </div>
  );
}
