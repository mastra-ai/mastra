import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Building2, GitBranch, ListTodo, Sparkles, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { CONNECTION_METHOD_LABEL } from '../../hooks/useProviderConnection';
import { useWorkSourceConnections, WORK_SOURCE_NAME, WORK_SOURCES } from '../../hooks/useWorkSourceConnections';
import { SETUP_LABELS } from '../../services/onboardingSteps';
import { isGitLabRepository } from '../../services/github';
import type { OnboardingDraft, OnboardingStep } from '../../services/onboardingFlow';

function OnboardingReviewRow({
  icon,
  label,
  value,
  detail,
  disabled,
  onEdit,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
  disabled: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="flex min-h-10 items-start gap-3">
      <span className="text-muted-foreground mt-1 size-4 shrink-0 [&>svg]:size-4" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <Txt variant="caption" className="truncate">
          {value}
        </Txt>
        {detail && (
          <Txt variant="meta" tone="muted" className="mt-1">
            {detail}
          </Txt>
        )}
      </div>
      <Button variant="ghost" size="sm" aria-label={`Edit ${label.toLowerCase()}`} disabled={disabled} onClick={onEdit}>
        Edit
      </Button>
    </div>
  );
}

function OnboardingWorkReviewRow({ disabled, onEdit }: { disabled: boolean; onEdit: () => void }) {
  const status = useWorkSourceConnections();
  const connected = WORK_SOURCES.filter(source => status[source]).map(source => WORK_SOURCE_NAME[source]);
  return (
    <OnboardingReviewRow
      icon={<ListTodo />}
      label="Work"
      value={connected.join(', ') || 'Set up later'}
      detail={connected.length ? 'Connected · choose issues after setup' : undefined}
      disabled={disabled}
      onEdit={onEdit}
    />
  );
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
            detail={
              local
                ? 'Factory default · local connection'
                : draft.modelScope === 'hybrid'
                  ? 'Company account · Factory work'
                  : 'Company account · Factory work and sessions'
            }
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
        <Button variant="primary" size="lg" disabled={pending || !repo} onClick={onConfirm}>
          {pending && <Spinner size="sm" aria-label="Creating factory" />}
          {pending ? 'Creating your factory…' : 'Create factory'}
        </Button>
      </div>
    </section>
  );
}
