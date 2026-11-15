import { Button } from '@mastra/playground-ui/components/Button';

import { GitLabIcon } from '../../../../ui/icons';
import { ProviderConnectControl } from '../../../settings/components/PlatformProviderConnections';
import { hostUnavailableDescription, isRecoverableHostReason } from '../../services/sourceControlHosts';
import type { HostUnavailableReason } from '../../services/sourceControlHosts';
import { OnboardingConnectionRow } from './OnboardingConnectionRow';
import { OnboardingHostRecoveryAction } from './OnboardingHostRecoveryAction';

export function OnboardingGitlabHostRow({
  unavailableReason,
  retrying,
  onConnected,
  onRetry,
}: {
  unavailableReason?: HostUnavailableReason;
  retrying: boolean;
  onConnected: () => void;
  onRetry: () => void;
}) {
  return (
    <OnboardingConnectionRow
      name="GitLab"
      icon={<GitLabIcon />}
      description={
        unavailableReason
          ? hostUnavailableDescription('gitlab', unavailableReason)
          : 'Projects, branches, and merge requests.'
      }
      tone={unavailableReason === 'unavailable' ? 'error' : 'muted'}
      action={
        <GitLabAction
          unavailableReason={unavailableReason}
          retrying={retrying}
          onConnected={onConnected}
          onRetry={onRetry}
        />
      }
    />
  );
}

function GitLabAction({
  unavailableReason,
  retrying,
  onConnected,
  onRetry,
}: {
  unavailableReason?: HostUnavailableReason;
  retrying: boolean;
  onConnected: () => void;
  onRetry: () => void;
}) {
  if (isRecoverableHostReason(unavailableReason)) {
    return (
      <OnboardingHostRecoveryAction host="gitlab" reason={unavailableReason} retrying={retrying} onRetry={onRetry} />
    );
  }
  if (unavailableReason) {
    return (
      <Button variant="default" disabled>
        Connect GitLab
      </Button>
    );
  }
  return (
    <ProviderConnectControl
      provider="gitlab"
      label="Connect GitLab"
      variant="default"
      size="md"
      onCompleted={onConnected}
    />
  );
}
