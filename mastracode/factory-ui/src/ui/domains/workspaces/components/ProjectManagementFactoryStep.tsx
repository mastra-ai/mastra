import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useWorkSourceConnections } from '../hooks/useWorkSourceConnections';
import type { BoardSource } from '../hooks/useWorkSourceConnections';
import type { SourceControlRepository } from '../services/github';
import { repositoryHost } from '../services/sourceControlHosts';
import { OnboardingCodeHostRow } from './onboarding/OnboardingCodeHostRow';
import { OnboardingInset } from './onboarding/OnboardingInset';
import { OnboardingLinearConnection } from './onboarding/OnboardingLinearConnection';
import { OnboardingPlatformConnection } from './onboarding/OnboardingPlatformConnection';
import { OnboardingStepCard } from './onboarding/OnboardingStepCard';

export interface ProjectManagementFactoryStepProps {
  onConnect: () => void;
  onContinue: () => void;
  onPreviewSource?: (source: BoardSource) => void;
  /** The codebase step's repository, listed as an issue source once it has been picked. */
  repository?: SourceControlRepository;
  /** Whether that repository feeds the board; only an explicit `false` turns it off. */
  codeHostSync?: boolean;
  onCodeHostSyncChange?: (enabled: boolean) => void;
}

export function ProjectManagementFactoryStep({
  onConnect,
  onContinue,
  onPreviewSource,
  repository,
  codeHostSync,
  onCodeHostSyncChange,
}: ProjectManagementFactoryStepProps) {
  const trackersConnected = Object.values(useWorkSourceConnections()).some(Boolean);
  const codeHostOn = repository !== undefined && codeHostSync !== false;
  const anyConnected = trackersConnected || codeHostOn;
  const codeHost = repository && (
    <div
      onMouseEnter={() => onPreviewSource?.(repositoryHost(repository))}
      onFocus={() => onPreviewSource?.(repositoryHost(repository))}
    >
      <OnboardingCodeHostRow repository={repository} enabled={codeHostOn} onEnabledChange={onCodeHostSyncChange} />
    </div>
  );
  return (
    <OnboardingStepCard
      section="project-management"
      headerEnd={
        <Txt variant="meta" tone="muted">
          Where new issues come from
        </Txt>
      }
      note={anyConnected ? 'You’ll choose which issues to bring in after setup' : undefined}
      primary={
        <Button variant={anyConnected ? 'primary' : 'ghost'} onClick={onContinue}>
          {anyConnected ? 'Continue' : 'Skip for now'}
        </Button>
      }
    >
      <OnboardingInset>
        {codeHost}
        <div onMouseEnter={() => onPreviewSource?.('linear')} onFocus={() => onPreviewSource?.('linear')}>
          <OnboardingLinearConnection onConnect={onConnect} />
        </div>
        <div onMouseEnter={() => onPreviewSource?.('jira')} onFocus={() => onPreviewSource?.('jira')}>
          <OnboardingPlatformConnection provider="jira" />
        </div>
        <div onMouseEnter={() => onPreviewSource?.('incident-io')} onFocus={() => onPreviewSource?.('incident-io')}>
          <OnboardingPlatformConnection provider="incident-io" />
        </div>
      </OnboardingInset>
    </OnboardingStepCard>
  );
}
