import { Button } from '@mastra/playground-ui/components/Button';
import type { UseQueryResult } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { useJiraProjectsQuery } from '../../../../hooks/useJiraData';
import { isJiraAuthError } from '../../factory/services/jira';
import type { JiraStatus } from '../../factory/services/jira';
import type { FactoryProject } from '../../workspaces/services/github';
import { IntakeProviderCard, toggleSourceId } from './IntakeProviderCard';
import type { IntakeSectionProps } from './IntakeProviderCard';
import { SourcePicker } from './IntakeSourcePicker';
import { groupJiraProjectsBySite } from './intakeSourceGroups';
import { IntakeSourceRouting } from './LinearRouting';
import { SettingsIntegrationIcon } from './brand-icons/SettingsIntegrationIcon';
import { IntakeSyncControl } from './common/IntakeSyncControl';

export function JiraIntakeSection({
  config,
  busy,
  update,
  factories,
  statusQuery,
}: IntakeSectionProps & {
  factories: FactoryProject[];
  statusQuery: UseQueryResult<JiraStatus>;
}) {
  const status = statusQuery.data;
  const configured = Boolean(status?.enabled && status.configured);
  const projectsQuery = useJiraProjectsQuery(configured);
  const projects = projectsQuery.data ?? [];
  const authError = isJiraAuthError(projectsQuery.error);
  const reauthRequired = status?.connections?.some(connection => connection.status === 'needs_reauth');
  const platformManaged = status?.mode === 'platform' || status?.connections !== undefined;
  const sites = status?.sites ?? (status?.site ? [status.site] : []);
  const account = sites.join(', ') || (configured && platformManaged ? 'Connected through Mastra Platform' : undefined);
  const description = connectionDescription();
  function connectionDescription() {
    if (statusQuery.isPending) return 'Checking the Jira connection…';
    if (statusQuery.isError) return "Couldn't load Jira status.";
    if (reauthRequired) return 'A connected Jira account needs to be reconnected.';
    if (authError)
      return platformManaged
        ? 'Jira rejected a connected account. Reconnect it to resume syncing.'
        : 'Jira rejected the configured credentials. Ask the operator to check the Jira API token.';
    if (!configured)
      return platformManaged
        ? 'Connect a Jira account to sync issues from this organization.'
        : 'Jira is not configured on this server. Set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN to enable it.';
    return undefined;
  }
  return (
    <IntakeProviderCard
      name="Jira"
      icon={<SettingsIntegrationIcon provider="jira" />}
      account={account}
      connected={configured || Boolean(status?.connections?.length) || statusQuery.isPending || statusQuery.isError}
      connectable={platformManaged}
      description={description}
      syncControl={
        <IntakeSyncControl
          accessibleLabel="Sync Jira issues"
          description="Active issues from selected projects feed your board."
          checked={config.jira.enabled}
          disabled={busy || !configured}
          onCheckedChange={enabled => update({ ...config, jira: { ...config.jira, enabled } })}
        />
      }
      action={
        statusQuery.isError && (
          <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => void statusQuery.refetch()}>
            Retry
          </Button>
        )
      }
    >
      {configured && config.jira.enabled && !authError && (
        <>
          <SourcePicker
            label="Jira projects"
            addLabel="Add project"
            itemIcon={<SettingsIntegrationIcon provider="jira" />}
            groups={groupJiraProjectsBySite(projects)}
            selectedIds={config.jira.sourceIds}
            disabled={busy}
            pending={busy}
            loading={projectsQuery.isPending}
            error={projectsQuery.isError ? "Couldn't load Jira projects." : undefined}
            onRetry={() => void projectsQuery.refetch()}
            onToggleItem={id =>
              update({ ...config, jira: { ...config.jira, sourceIds: toggleSourceId(config.jira.sourceIds, id) } })
            }
          />
          {!projectsQuery.isError && (
            <IntakeSourceRouting
              integrationId="jira"
              label="Jira"
              sourceIds={config.jira.sourceIds ?? []}
              sources={projects.map(project => ({ id: project.id, name: `${project.key} · ${project.name}` }))}
              factories={factories}
            />
          )}
        </>
      )}
    </IntakeProviderCard>
  );
}
