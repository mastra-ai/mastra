import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GitBranch, ListTodo, Sparkles, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLinearStatusQuery } from '../../../../../hooks/useLinearData';
import { usePlatformConnectionsQuery } from '../../../../../hooks/usePlatformConnections';
import { providerDisplayName } from '../../../settings/components/provider-display-name';
import { isGitLabRepository } from '../../services/github';
import type { OnboardingConnectionChoice, OnboardingDraft, OnboardingStep } from '../../services/onboardingFlow';
import { usesPersonalFactoryModel } from '../../services/onboardingModelChoice';

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
  const linear = useLinearStatusQuery();
  const jira = usePlatformConnectionsQuery('jira');
  const incidents = usePlatformConnectionsQuery('incident-io');
  const connected = [
    linear.data?.connected ? 'Linear' : undefined,
    jira.data?.some(item => item.status === 'active') ? 'Jira' : undefined,
    incidents.data?.some(item => item.status === 'active') ? 'incident.io' : undefined,
  ].filter(Boolean);
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

function personalAccessValue(personal?: OnboardingConnectionChoice) {
  if (!personal) return 'No personal connection selected';
  return personal.modelId ?? providerDisplayName(personal.providerId);
}

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
        {!personalIsFactoryModel && (
          <OnboardingReviewRow
            icon={<UserRound />}
            label="Access"
            value={personalAccessValue(personal)}
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
