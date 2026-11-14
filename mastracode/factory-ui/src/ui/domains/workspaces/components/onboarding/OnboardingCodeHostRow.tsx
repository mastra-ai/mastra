import { Switch } from '@mastra/playground-ui/components/Switch';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';

import { GitLabIcon } from '../../../../ui/icons';
import type { SourceControlRepository } from '../../services/github';
import { HOST_NAMES, repositoryHost } from '../../services/sourceControlHosts';
import { OnboardingConnectionRow } from './OnboardingConnectionRow';

/**
 * The codebase step's repository as an issue source. Unlike a tracker there is nothing to connect:
 * the repository was picked in the first step, so the switch only decides whether it feeds the board.
 */
export function OnboardingCodeHostRow({
  repository,
  enabled,
  onEnabledChange,
}: {
  repository: SourceControlRepository;
  enabled: boolean;
  /** Omitted where the choice cannot be stored, which leaves the switch read-only. */
  onEnabledChange?: (enabled: boolean) => void;
}) {
  const host = repositoryHost(repository);
  const name = HOST_NAMES[host];
  return (
    <OnboardingConnectionRow
      icon={host === 'gitlab' ? <GitLabIcon /> : <GithubIcon />}
      name={name}
      description={`Sync issues from ${repository.fullName}`}
      action={
        <Switch
          aria-label={`Sync ${name} issues`}
          checked={enabled}
          disabled={onEnabledChange === undefined}
          onCheckedChange={onEnabledChange}
        />
      }
    />
  );
}
