import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GitBranch, Sparkles, UserRound, Users } from 'lucide-react';
import { providerDisplayName } from '../../settings/components/provider-display-name';
import { isGitLabRepository } from '../services/github';
import type { OnboardingDraft, OnboardingStep } from '../services/onboardingFlow';
import { includesPersonalSetup, modelSetupLabel } from '../services/modelSetupPreset';
import { usesPersonalFactoryModel } from '../services/onboardingModelChoice';
import { OnboardingReviewRow } from './OnboardingReviewRow';
import { OnboardingWorkReviewRow } from './OnboardingWorkReviewRow';

export function OnboardingReviewStep({
  draft,
  onEdit,
  onConfirm,
  pending,
  error,
}: {
  draft: OnboardingDraft;
  onEdit: (step: OnboardingStep) => void;
  onConfirm: () => void;
  pending: boolean;
  error?: string;
}) {
  const repo = draft.repository;
  const personal = draft.personal;
  const personalValue =
    personal?.modelId ?? (personal ? providerDisplayName(personal.providerId) : 'No personal connection selected');
  const personalMethod = personal?.method === 'oauth' ? 'Provider sign-in' : 'API key';
  const personalScope = personal?.modelId ? 'your default' : 'only you';
  const personalIsFactoryModel = usesPersonalFactoryModel(draft);
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
        {draft.preset && (
          <OnboardingReviewRow
            icon={<Users />}
            label="Setup"
            value={modelSetupLabel(draft.preset)}
            disabled={pending}
            onEdit={() => onEdit('model-preset')}
          />
        )}
        {personalIsFactoryModel ? (
          <OnboardingReviewRow
            icon={<Sparkles />}
            label="Model"
            value={personal?.modelId ?? 'Choose a model'}
            detail={`${personalMethod} · Factory + your default`}
            disabled={pending}
            onEdit={() => onEdit('personal-provider')}
          />
        ) : (
          <OnboardingReviewRow
            icon={<Sparkles />}
            label="Model"
            value={draft.model?.modelId ?? 'Set up with an admin later'}
            detail={draft.model ? 'Factory default · organization account' : undefined}
            disabled={pending}
            onEdit={() => onEdit('model-provider')}
          />
        )}
        {!personalIsFactoryModel && (!draft.preset || includesPersonalSetup(draft.preset)) && (
          <OnboardingReviewRow
            icon={<UserRound />}
            label="Access"
            value={personalValue}
            detail={personal ? `${personalMethod} · ${personalScope}` : undefined}
            disabled={pending}
            onEdit={() => onEdit('personal-provider')}
          />
        )}
      </div>
      {error && (
        <Txt variant="caption" role="alert">
          {error}
        </Txt>
      )}
      <div>
        <Button variant="primary" size="lg" disabled={pending || !repo} onClick={onConfirm}>
          {pending && <Spinner size="sm" aria-label="Creating factory" />}
          {pending ? 'Creating your factory…' : 'Create factory'}
        </Button>
      </div>
    </section>
  );
}
