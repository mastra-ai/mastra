import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Building2, GitBranch, Sparkles, UserRound } from 'lucide-react';
import { CONNECTION_METHOD_LABEL } from '../../hooks/useProviderConnection';
import { SETUP_LABELS } from '../../services/onboardingSteps';
import { isGitLabRepository } from '../../services/github';
import { completeOnboardingSchema } from '../../services/onboardingFlow';
import type { OnboardingDraft, OnboardingModelScope, OnboardingStep } from '../../services/onboardingFlow';

import { OnboardingReviewRow } from './OnboardingReviewRow';
import { OnboardingWorkReviewRow } from './OnboardingWorkReviewRow';

function sharedModelDetail(scope: OnboardingModelScope | undefined, local: boolean) {
  if (local) return 'Factory default · local connection';
  if (scope === 'hybrid') return 'Company account · Factory work';
  return 'Company account · Factory work and sessions';
}

export function OnboardingReviewStep({
  draft,
  local = false,
  onEdit,
  onConfirm,
  pending,
  error,
}: {
  draft: OnboardingDraft;
  local?: boolean;
  onEdit: (step: OnboardingStep) => void;
  onConfirm: () => void;
  pending: boolean;
  error?: string;
}) {
  const repo = draft.repository;
  const personal = draft.personal;
  const personalMethod = personal && CONNECTION_METHOD_LABEL[personal.method];
  const shared = draft.modelScope !== 'user';
  const readyToCreate = completeOnboardingSchema.safeParse(draft).success;
  return (
    <section aria-label="Review factory setup" className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:gap-4">
        <OnboardingReviewRow
          icon={<GitBranch />}
          label="Codebase"
          value={repo?.fullName ?? 'Choose a repository'}
          detail={repo ? `${isGitLabRepository(repo) ? 'GitLab' : 'GitHub'} · ${repo.defaultBranch}` : undefined}
          disabled={pending}
          onEdit={() => onEdit('vcs')}
        />
        <OnboardingWorkReviewRow disabled={pending} onEdit={() => onEdit('project-management')} />
        {!local && (
          <OnboardingReviewRow
            icon={<Building2 />}
            label="Setup"
            value={draft.modelScope ? SETUP_LABELS[draft.modelScope] : 'Choose a setup'}
            detail="Applies to this Factory"
            disabled={pending}
            onEdit={() => onEdit('model-setup')}
          />
        )}
        {shared ? (
          <OnboardingReviewRow
            icon={<Sparkles />}
            label="Model"
            value={draft.model?.modelId ?? 'Choose a model'}
            detail={sharedModelDetail(draft.modelScope, local)}
            disabled={pending}
            onEdit={() => onEdit('model-provider')}
          />
        ) : (
          <OnboardingReviewRow
            icon={<Sparkles />}
            label="Model"
            value={personal?.modelId ?? 'Choose a model'}
            detail={personal && `${personalMethod} · your default for work and sessions`}
            disabled={pending}
            onEdit={() => onEdit('personal-provider')}
          />
        )}
        {draft.modelScope === 'hybrid' && (
          <OnboardingReviewRow
            icon={<UserRound />}
            label="Personal model"
            value={personal?.modelId ?? 'Choose your session model'}
            detail={personal ? `${personalMethod} · your default for sessions` : undefined}
            disabled={pending}
            onEdit={() => onEdit('personal-provider')}
          />
        )}
      </div>
      {draft.modelScope !== 'factory' && (
        <Txt variant="meta" tone="muted">
          Your personal default is used wherever your account powers a session or Factory work. Teammates keep their own
          defaults.
        </Txt>
      )}
      {error && (
        <Txt variant="caption" role="alert">
          {error}
        </Txt>
      )}
      <div>
        <Button variant="primary" size="lg" disabled={pending || !readyToCreate} onClick={onConfirm}>
          {pending && <Spinner size="sm" aria-label="Creating factory" />}
          {pending ? 'Creating your factory…' : 'Create factory'}
        </Button>
      </div>
    </section>
  );
}
