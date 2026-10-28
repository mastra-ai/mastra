import { Button } from '@mastra/playground-ui/components/Button';
import type { UseQueryResult } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { useFactoriesQuery } from '../../../../hooks/useFactories';
import { useGitLabProjectsQuery } from '../../../../hooks/useGitLabData';
import { isGitLabAuthError, isGitLabReauthRequired } from '../../factory/services/gitlab';
import type { GitLabStatus } from '../../factory/services/gitlab';
import { IntakeProviderCard, toggleSourceId } from './IntakeProviderCard';
import type { IntakeSectionProps } from './IntakeProviderCard';
import { RoutedSourcePicker } from './IntakeSourceRouting';
import { groupGitLabProjectsByAccount } from './intakeSourceGroups';
import { SettingsIntegrationIcon } from './brand-icons/SettingsIntegrationIcon';
import { IntakeSyncControl } from './common/IntakeSyncControl';

export function GitLabIntakeSection({
  config,
  busy,
  update,
  listed,
  statusQuery,
}: IntakeSectionProps & { statusQuery: UseQueryResult<GitLabStatus> }) {
  const factories = useFactoriesQuery().data ?? [];
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
    if (statusUnavailable) return "Couldn't load GitLab status.";
    if (reauthRequired) return 'A GitLab account needs to be reconnected in Mastra Platform.';
    if (authError) {
      return platformManaged
        ? 'GitLab rejected a connected account. Reconnect it in Mastra Platform.'
        : 'GitLab rejected the configured access token. Ask the operator to check it.';
    }
    if (!configured) {
      return platformManaged
        ? 'Connect GitLab in Mastra Platform to sync issues from this organization.'
        : 'GitLab is not configured on this server. Configure a GitLab access token to enable it.';
    }
    return undefined;
  }
  return (
    <IntakeProviderCard
      name="GitLab"
      icon={<SettingsIntegrationIcon provider="gitlab" />}
      account={status?.accounts?.join(', ')}
      listed={listed}
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
        <RoutedSourcePicker
          integrationId="gitlab"
          routingLabel="GitLab"
          factories={factories}
          label="GitLab projects"
          addLabel="Add project"
          itemIcon={<SettingsIntegrationIcon provider="gitlab" />}
          groups={groupGitLabProjectsByAccount(projects)}
          selectedIds={projectsQuery.isPending ? [] : config.gitlab.sourceIds}
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
      )}
    </IntakeProviderCard>
  );
}
