import { Button } from '@mastra/playground-ui/components/Button';
import type { UseQueryResult } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { useGitLabProjectsQuery } from '../../../../hooks/useGitLabData';
import { isGitLabAuthError, isGitLabReauthRequired } from '../../factory/services/gitlab';
import type { GitLabStatus } from '../../factory/services/gitlab';
import type { FactoryProject } from '../../workspaces/services/github';
import { IntakeProviderCard, toggleSourceId } from './IntakeProviderCard';
import type { IntakeSectionProps } from './IntakeProviderCard';
import { SourcePicker } from './IntakeSourcePicker';
import { groupGitLabProjectsByAccount } from './intakeSourceGroups';
import { IntakeSourceRouting } from './LinearRouting';
import { SettingsIntegrationIcon } from './brand-icons/SettingsIntegrationIcon';
import { IntakeSyncControl } from './common/IntakeSyncControl';

export function GitLabIntakeSection({
  config,
  busy,
  update,
  factories,
  statusQuery,
}: IntakeSectionProps & {
  factories: FactoryProject[];
  statusQuery: UseQueryResult<GitLabStatus>;
}) {
  const status = statusQuery.data;
  const statusUnavailable = statusQuery.isError || status?.reason === 'unavailable';
  const configured = Boolean(status?.enabled && status.configured);
  const projectsQuery = useGitLabProjectsQuery(configured);
  const authError = isGitLabAuthError(projectsQuery.error);
  const reauthRequired = isGitLabReauthRequired(status);
  const platformManaged = status?.connections !== undefined;
  const projects = projectsQuery.data ?? [];
  const description = connectionDescription();
  function connectionDescription() {
    if (statusQuery.isPending) return 'Checking the GitLab connection…';
    if (statusUnavailable) return "Couldn't load GitLab status.";
    if (reauthRequired) return 'A GitLab account needs to be reconnected in Mastra Platform.';
    if (authError)
      return platformManaged
        ? 'GitLab rejected a connected account. Reconnect it in Mastra Platform.'
        : 'GitLab rejected the configured access token. Ask the operator to check it.';
    if (!configured)
      return platformManaged
        ? 'Connect GitLab in Mastra Platform to sync issues from this organization.'
        : 'GitLab is not configured on this server. Configure a GitLab access token to enable it.';
    return undefined;
  }
  return (
    <IntakeProviderCard
      name="GitLab"
      icon={<SettingsIntegrationIcon provider="gitlab" />}
      account={status?.accounts?.join(', ')}
      connected={configured || Boolean(status?.connections?.length) || statusQuery.isPending || statusUnavailable}
      connectable={platformManaged}
      description={description}
      syncControl={
        <IntakeSyncControl
          accessibleLabel="Sync GitLab issues"
          description="Open issues from selected projects feed your board."
          checked={config.gitlab.enabled}
          disabled={busy || !configured}
          onCheckedChange={enabled => update({ ...config, gitlab: { ...config.gitlab, enabled } })}
        />
      }
      action={
        statusUnavailable && (
          <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => void statusQuery.refetch()}>
            Retry
          </Button>
        )
      }
    >
      {configured && config.gitlab.enabled && !authError && (
        <>
          <SourcePicker
            label="GitLab projects"
            addLabel="Add project"
            itemIcon={<SettingsIntegrationIcon provider="gitlab" />}
            groups={groupGitLabProjectsByAccount(projects)}
            selectedIds={config.gitlab.sourceIds}
            disabled={busy}
            pending={busy}
            loading={projectsQuery.isPending}
            error={projectsQuery.isError ? "Couldn't load GitLab projects." : undefined}
            onRetry={() => void projectsQuery.refetch()}
            onToggleItem={id =>
              update({
                ...config,
                gitlab: { ...config.gitlab, sourceIds: toggleSourceId(config.gitlab.sourceIds, id) },
              })
            }
          />
          {!projectsQuery.isError && (
            <IntakeSourceRouting
              integrationId="gitlab"
              label="GitLab"
              sourceIds={config.gitlab.sourceIds ?? []}
              sources={projects}
              factories={factories}
            />
          )}
        </>
      )}
    </IntakeProviderCard>
  );
}
