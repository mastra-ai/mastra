import type { ReactNode } from 'react';
import { IntakeProviderCard } from './intake-provider-card';
import type { IntakeSectionProps } from './intake-provider-card';
import { toggleSource } from './intake-selection';
import { groupGitLabProjectsByAccount, groupJiraProjectsBySite } from './intake-source-groups';
import type { GitLabProjectSource, JiraProjectSource } from './intake-source-groups';
import type { SourcePickerProps } from './intake-source-picker';
import type { IntakeSelection } from './intake-types';
import { SettingsIntegrationIcon as IntegrationIcon } from './integration-icon';
import { connectionName } from './platform-connect-providers';
import type { PlatformProviderConnection } from './platform-connect-providers';
import {
  AddPlatformAccountButton,
  PlatformConnectButton,
  PlatformConnectionActions,
} from './platform-provider-connections';
import { Button } from '@/ds/components/Button';
import { IconArrowRotateCounterClockwise } from '@/ds/icons/central/IconArrowRotateCounterClockwise';

/** The slice of a query result the cards read; a TanStack `UseQueryResult` satisfies it. */
export interface IntakeQueryState<T> {
  data: T | undefined;
  error?: unknown;
  isError: boolean;
  isPending: boolean;
  refetch: () => unknown;
}

export interface IntakeSelectionState {
  saving: boolean;
  update: (change: (current: IntakeSelection) => IntakeSelection) => void;
}

export type IntakeSourcePickerSlotProps = SourcePickerProps & { integrationId: string; routingLabel: string };

/** Hosts render the picker: Factory adds routing to its factories, a single-Factory host renders a plain picker. */
export type RenderIntakeSourcePicker = (props: IntakeSourcePickerSlotProps) => ReactNode;

interface ProviderCardProps extends IntakeSectionProps {
  selection: IntakeSelectionState;
  renderPicker: RenderIntakeSourcePicker;
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" variant="ghost" icon={<IconArrowRotateCounterClockwise />} onClick={onClick}>
      Retry
    </Button>
  );
}

const authFailed = (error: unknown, code: string) => (error as { code?: string } | null)?.code === code;

export interface JiraIntakeStatus {
  enabled: boolean;
  configured: boolean;
  mode?: 'direct' | 'platform';
  site?: string | null;
  sites?: string[];
  connections?: PlatformProviderConnection[];
}

export function JiraIntakeCard({
  config,
  listed,
  selection,
  renderPicker,
  statusQuery,
  projectsQuery,
}: ProviderCardProps & {
  statusQuery: IntakeQueryState<JiraIntakeStatus>;
  projectsQuery: IntakeQueryState<JiraProjectSource[]>;
}) {
  const status = statusQuery.data;
  const configured = Boolean(status?.enabled && status.configured);
  const projects = projectsQuery.data ?? [];
  const authError = authFailed(projectsQuery.error, 'jira_auth_failed');
  const reauthRequired = status?.connections?.some(connection => connection.status === 'needs_reauth');
  const platformManaged = status?.mode === 'platform' || status?.connections !== undefined;
  const sites = status?.sites ?? (status?.site ? [status.site] : []);
  const account = sites.join(', ') || (configured && platformManaged ? 'Connected through Mastra Platform' : undefined);
  const description = connectionDescription();
  function connectionDescription() {
    if (statusQuery.isError) return "Couldn't load Jira status.";
    if (reauthRequired) return 'A connected Jira account needs to be reconnected.';
    if (authError)
      return platformManaged
        ? 'Jira rejected a connected account. Reauthorize it from Manage to resume syncing.'
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
      icon={<IntegrationIcon provider="jira" />}
      account={account}
      listed={listed}
      connection={
        platformManaged &&
        (listed ? (
          <>
            {(status?.connections?.length ?? 0) > 0 && <AddPlatformAccountButton provider="jira" />}
            <PlatformConnectionActions provider="jira" connections={status?.connections ?? []} />
          </>
        ) : (
          <PlatformConnectButton provider="jira" />
        ))
      }
      description={description}
      action={statusQuery.isError && <RetryButton onClick={() => void statusQuery.refetch()} />}
    >
      {configured &&
        !authError &&
        renderPicker({
          integrationId: 'jira',
          routingLabel: 'Jira',
          label: 'Jira projects',
          addLabel: 'Add project',
          itemIcon: <IntegrationIcon provider="jira" />,
          groups: groupJiraProjectsBySite(projects),
          selectedIds: projectsQuery.isPending ? [] : config.jira.sourceIds,
          saving: selection.saving,
          loading: projectsQuery.isPending,
          error: projectsQuery.isError ? "Couldn't load Jira projects." : undefined,
          onRetry: () => void projectsQuery.refetch(),
          onToggleItem: id => selection.update(current => toggleSource(current, id)),
        })}
    </IntakeProviderCard>
  );
}

export interface GitLabIntakeStatus {
  enabled: boolean;
  configured: boolean;
  mode?: 'direct' | 'platform';
  connections?: PlatformProviderConnection[];
  accounts?: string[];
  reauthRequired: boolean;
  reason?: string;
}

export function GitLabIntakeCard({
  config,
  listed,
  selection,
  renderPicker,
  statusQuery,
  projectsQuery,
}: ProviderCardProps & {
  statusQuery: IntakeQueryState<GitLabIntakeStatus>;
  projectsQuery: IntakeQueryState<GitLabProjectSource[]>;
}) {
  const status = statusQuery.data;
  const statusUnavailable = statusQuery.isError || status?.reason === 'unavailable';
  const configured = Boolean(status?.enabled && status.configured);
  const authError = authFailed(projectsQuery.error, 'gitlab_auth_failed');
  const reauthRequired = Boolean(
    status?.reauthRequired || status?.connections?.some(connection => connection.status === 'needs_reauth'),
  );
  const platformManaged = status?.connections !== undefined;
  const projects = projectsQuery.data ?? [];
  const description = connectionDescription();
  function connectionDescription() {
    if (statusUnavailable) return "Couldn't load GitLab status.";
    if (reauthRequired) return 'A GitLab account needs to be reconnected.';
    if (authError)
      return platformManaged
        ? 'GitLab rejected a connected account. Reauthorize it from Manage to resume syncing.'
        : 'GitLab rejected the configured access token. Ask the operator to check it.';
    if (!configured)
      return platformManaged
        ? 'Connect GitLab to sync issues from this organization.'
        : 'GitLab is not configured on this server. Configure a GitLab access token to enable it.';
    return undefined;
  }
  return (
    <IntakeProviderCard
      name="GitLab"
      icon={<IntegrationIcon provider="gitlab" />}
      account={status?.accounts?.join(', ')}
      listed={listed}
      connection={
        platformManaged &&
        (listed ? (
          <>
            {status?.mode === 'platform' && (status.connections?.length ?? 0) > 0 && (
              <>
                <AddPlatformAccountButton provider="gitlab" />
                <AddPlatformAccountButton provider="gitlab-self-hosted" buttonLabel="Add self-hosted" />
              </>
            )}
            <PlatformConnectionActions provider="gitlab" connections={status?.connections ?? []} />
          </>
        ) : (
          <>
            <PlatformConnectButton provider="gitlab" />
            <PlatformConnectButton provider="gitlab-self-hosted" buttonLabel="Connect self-hosted" />
          </>
        ))
      }
      description={description}
      action={statusUnavailable && <RetryButton onClick={() => void statusQuery.refetch()} />}
    >
      {configured &&
        !authError &&
        renderPicker({
          integrationId: 'gitlab',
          routingLabel: 'GitLab',
          label: 'GitLab projects',
          addLabel: 'Add project',
          itemIcon: <IntegrationIcon provider="gitlab" />,
          groups: groupGitLabProjectsByAccount(projects),
          selectedIds: projectsQuery.isPending ? [] : config.gitlab.sourceIds,
          saving: selection.saving,
          loading: projectsQuery.isPending,
          error: projectsQuery.isError ? "Couldn't load GitLab projects." : undefined,
          onRetry: () => void projectsQuery.refetch(),
          onToggleItem: id => selection.update(current => toggleSource(current, id)),
        })}
    </IntakeProviderCard>
  );
}

export interface IncidentioIntakeStatus {
  enabled: boolean;
  configured: boolean;
  mode?: 'api-key' | 'platform';
  reason?: string;
}

export interface IntakeNamedSource {
  id: string;
  name: string;
}

/** A deployment API key serves follow-ups without a Platform connection. */
export function isIncidentioDirectConfigured(status: IncidentioIntakeStatus | undefined) {
  return Boolean(status?.enabled && status.configured && status.mode === 'api-key' && status.reason === 'ready');
}

export function IncidentioIntakeCard({
  config,
  listed,
  selection,
  renderPicker,
  statusQuery,
  connectionsQuery,
  sourcesQuery,
}: ProviderCardProps & {
  statusQuery: IntakeQueryState<IncidentioIntakeStatus>;
  connectionsQuery: IntakeQueryState<PlatformProviderConnection[]>;
  /** Hosts enable this only when `incidentioCredentialActive` is true. */
  sourcesQuery: IntakeQueryState<IntakeNamedSource[]>;
}) {
  const directConfigured = isIncidentioDirectConfigured(statusQuery.data);
  const connections = connectionsQuery.data ?? [];
  const active = connections.filter(connection => connection.status === 'active');
  const credentialActive = directConfigured || active.length > 0;
  const sources = sourcesQuery.data ?? [];
  const description = connectionDescription();
  function connectionDescription() {
    if (!directConfigured && connectionsQuery.isError) return "Couldn't load incident.io connections.";
    if (statusQuery.isError && !active.length) return "Couldn't load incident.io status.";
    if (!directConfigured && connections.some(connection => connection.status === 'needs_reauth'))
      return 'An incident.io account needs to be reconnected to keep syncing follow-ups.';
    if (!credentialActive) return 'Connect incident.io to sync follow-ups.';
    return undefined;
  }
  const account = directConfigured
    ? 'incident.io API key configured on this server'
    : connections.map(connectionName).join(', ');
  const unavailable = !directConfigured && (connectionsQuery.isError || statusQuery.isError);
  return (
    <IntakeProviderCard
      name="incident.io"
      icon={<IntegrationIcon provider="incidentio" />}
      account={account}
      listed={listed}
      description={description}
      connection={
        !directConfigured &&
        !unavailable &&
        (listed ? (
          <>
            {connections.length > 0 && <AddPlatformAccountButton provider="incident-io" />}
            <PlatformConnectionActions provider="incident-io" connections={connections} />
          </>
        ) : (
          <PlatformConnectButton provider="incident-io" />
        ))
      }
      action={
        unavailable && (
          <RetryButton
            onClick={() => {
              void connectionsQuery.refetch();
              void statusQuery.refetch();
            }}
          />
        )
      }
    >
      {(credentialActive || Boolean(config.incidentio.sourceIds?.length)) &&
        renderPicker({
          integrationId: 'incidentio',
          routingLabel: 'incident.io',
          label: 'Follow-up sources',
          addLabel: 'Add follow-up source',
          itemIcon: <IntegrationIcon provider="incidentio" />,
          groups: [
            { id: 'incidentio-follow-ups', items: sources.map(source => ({ id: source.id, label: source.name })) },
          ],
          selectedIds: config.incidentio.sourceIds,
          saving: selection.saving,
          loading: credentialActive && sourcesQuery.isPending,
          error: !credentialActive
            ? 'Reconnect incident.io to add follow-up sources.'
            : sourcesQuery.isError
              ? "Couldn't load follow-up sources."
              : undefined,
          onRetry: credentialActive ? () => void sourcesQuery.refetch() : undefined,
          onToggleItem: id => selection.update(current => toggleSource(current, id)),
        })}
    </IntakeProviderCard>
  );
}

export function incidentioCredentialActive(
  status: IncidentioIntakeStatus | undefined,
  connections: PlatformProviderConnection[] | undefined,
) {
  return isIncidentioDirectConfigured(status) || Boolean(connections?.some(c => c.status === 'active'));
}

export interface VantaIntakeStatus {
  enabled: boolean;
  configured: boolean;
  reason: 'ready' | 'missing_config' | 'organization_required' | 'auth_required';
}

export function vantaSourcesEnabled(
  status: VantaIntakeStatus | undefined,
  connections: PlatformProviderConnection[] | undefined,
) {
  return status?.reason === 'ready' && Boolean(connections?.some(c => c.status === 'active'));
}

export function VantaIntakeCard({
  config,
  listed,
  selection,
  renderPicker,
  statusQuery,
  connectionsQuery,
  sourcesQuery,
}: ProviderCardProps & {
  statusQuery: IntakeQueryState<VantaIntakeStatus>;
  connectionsQuery: IntakeQueryState<PlatformProviderConnection[]>;
  /** Hosts enable this only when `vantaSourcesEnabled` is true. */
  sourcesQuery: IntakeQueryState<IntakeNamedSource[]>;
}) {
  const vanta = config.vanta ?? { enabled: false, sourceIds: null };
  const ready = statusQuery.data?.reason === 'ready';
  const connections = connectionsQuery.data ?? [];
  const connected = connections.some(connection => connection.status === 'active');
  const sources = sourcesQuery.data ?? [];
  const unavailable = connectionsQuery.isError || statusQuery.isError;
  const description = connectionsQuery.isError
    ? "Couldn't load Vanta connections."
    : statusQuery.isError
      ? "Couldn't load Vanta status."
      : connections.some(connection => connection.status === 'needs_reauth')
        ? 'A Vanta account needs to be reconnected to keep syncing vulnerabilities.'
        : !connected
          ? 'Connect Vanta to sync vulnerabilities.'
          : undefined;

  return (
    <IntakeProviderCard
      name="Vanta"
      icon={<IntegrationIcon provider="vanta" />}
      account={connections.map(connectionName).join(', ')}
      listed={listed}
      description={description}
      connection={
        !unavailable &&
        (listed ? (
          <>
            {connections.length > 0 && <AddPlatformAccountButton provider="vanta" />}
            <PlatformConnectionActions provider="vanta" connections={connections} />
          </>
        ) : (
          <PlatformConnectButton provider="vanta" />
        ))
      }
      action={
        (unavailable || sourcesQuery.isError) && (
          <RetryButton
            onClick={() => {
              void connectionsQuery.refetch();
              void statusQuery.refetch();
              void sourcesQuery.refetch();
            }}
          />
        )
      }
    >
      {(connected || Boolean(vanta.sourceIds?.length)) &&
        renderPicker({
          integrationId: 'vanta',
          routingLabel: 'Vanta',
          label: 'Vulnerability sources',
          addLabel: 'Add vulnerability source',
          itemIcon: <IntegrationIcon provider="vanta" />,
          groups: [
            { id: 'vanta-vulnerabilities', items: sources.map(source => ({ id: source.id, label: source.name })) },
          ],
          selectedIds: vanta.sourceIds,
          saving: selection.saving,
          loading: ready && sourcesQuery.isPending,
          error: sourcesQuery.isError ? "Couldn't load Vanta sources." : undefined,
          onRetry: () => void sourcesQuery.refetch(),
          onToggleItem: id => selection.update(current => toggleSource(current, id)),
        })}
    </IntakeProviderCard>
  );
}
