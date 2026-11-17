import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';

import { hostUnavailableDescription, isRecoverableHostReason } from '../../services/sourceControlHosts';
import type { HostUnavailableReason } from '../../services/sourceControlHosts';
import { OnboardingConnectionRow } from './OnboardingConnectionRow';
import { OnboardingHostRecoveryAction } from './OnboardingHostRecoveryAction';

export function OnboardingGithubHostRow({
  redirecting,
  unavailableReason,
  retrying,
  onConnect,
  onRetry,
}: {
  redirecting: boolean;
  unavailableReason?: HostUnavailableReason;
  retrying: boolean;
  onConnect: () => void;
  onRetry: () => void;
}) {
  return (
    <OnboardingConnectionRow
      name="GitHub"
      icon={<GithubIcon />}
      description={
        unavailableReason
          ? hostUnavailableDescription('github', unavailableReason)
          : 'Repositories, branches, and pull requests.'
      }
      tone={unavailableReason === 'unavailable' ? 'error' : 'muted'}
      action={
        isRecoverableHostReason(unavailableReason) ? (
          <OnboardingHostRecoveryAction
            host="github"
            reason={unavailableReason}
            retrying={retrying}
            onRetry={onRetry}
          />
        ) : (
          <Button variant="default" disabled={redirecting || unavailableReason !== undefined} onClick={onConnect}>
            {redirecting && <Spinner size="sm" aria-label="Connecting to GitHub" />}
            Connect GitHub
          </Button>
        )
      }
    />
  );
}
