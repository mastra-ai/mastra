import { Button } from '@mastra/playground-ui/components/Button';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';
import { useWorkSourceConnections } from '../hooks/useWorkSourceConnections';
import type { BoardSource } from '../hooks/useWorkSourceConnections';
import type { SourceControlRepository } from '../services/github';
import { repositoryHost } from '../services/sourceControlHosts';
import { OnboardingCodeHostRow } from './onboarding/OnboardingCodeHostRow';
import { OnboardingInset } from './onboarding/OnboardingInset';
import {
  OnboardingLinearConnection,
  OnboardingLinearConnectionSkeleton,
} from './onboarding/OnboardingLinearConnection';
import {
  OnboardingPlatformConnection,
  OnboardingPlatformConnectionSkeleton,
} from './onboarding/OnboardingPlatformConnection';
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
    <ProjectManagementStepCard
      note={anyConnected ? 'You’ll choose which issues to bring in after setup' : undefined}
      primary={
        <Button variant={anyConnected ? 'primary' : 'ghost'} onClick={onContinue}>
          {anyConnected ? 'Continue' : 'Skip for now'}
        </Button>
      }
    >
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
    </ProjectManagementStepCard>
  );
}

export function ProjectManagementFactoryStepSkeleton({
  repository,
  codeHostSync,
}: Pick<ProjectManagementFactoryStepProps, 'repository' | 'codeHostSync'>) {
  return (
    <ProjectManagementStepCard
      primary={<Skeleton aria-hidden className="h-control-md w-28 rounded-full motion-reduce:before:animate-none" />}
    >
      {repository && (
        <div inert>
          <OnboardingCodeHostRow
            repository={repository}
            enabled={codeHostSync !== false}
            onEnabledChange={() => undefined}
          />
        </div>
      )}
      <OnboardingLinearConnectionSkeleton />
      <OnboardingPlatformConnectionSkeleton provider="jira" />
      <OnboardingPlatformConnectionSkeleton provider="incident-io" />
    </ProjectManagementStepCard>
  );
}

function ProjectManagementStepCard({
  note,
  primary,
  children,
}: {
  note?: string;
  primary: ReactNode;
  children: ReactNode;
}) {
  return (
    <OnboardingStepCard
      section="project-management"
      headerEnd={
        <Txt variant="meta" tone="muted">
          Where new issues come from
        </Txt>
      }
      note={note}
      primary={primary}
    >
      <OnboardingInset>{children}</OnboardingInset>
    </OnboardingStepCard>
  );
}
