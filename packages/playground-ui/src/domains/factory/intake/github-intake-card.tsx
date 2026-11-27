import type { ReactNode } from 'react';
import { IntakeProviderCard } from './intake-provider-card';
import type { IntakeSectionProps } from './intake-provider-card';
import { toggleSource, toggleSourceId } from './intake-selection';
import { SourcePicker } from './intake-source-picker';
import { IntakeSyncControl } from './intake-sync-control';
import type { IntakeSelection } from './intake-types';
import { SettingsIntegrationIcon } from './integration-icon';
import type { IntakeQueryState, IntakeSelectionState } from './provider-intake-cards';
import { Button } from '@/ds/components/Button';
import { IconArrowRotateCounterClockwise } from '@/ds/icons/central/IconArrowRotateCounterClockwise';
import { SettingsRow } from '@/ds/new/settings';

export interface GithubIntakeStatus {
  enabled: boolean;
  connected: boolean;
  installations: { accountLogin: string | null }[];
  reason?: string;
}

export interface GithubIntakeCardProps extends IntakeSectionProps {
  selection: IntakeSelectionState;
  dependabotSelection: IntakeSelectionState;
  statusQuery: IntakeQueryState<GithubIntakeStatus> & { isFetching?: boolean };
  /** Repository slugs the host offers as sources. */
  repositoriesQuery: IntakeQueryState<string[]> & { isSuccess?: boolean };
  /** Host-owned Connect / Manage controls. */
  connectButton?: ReactNode;
  manageButton?: ReactNode;
  emptyDescription?: string;
}

export function GithubIntakeCard({
  config,
  listed,
  selection,
  dependabotSelection,
  statusQuery,
  repositoriesQuery,
  connectButton,
  manageButton,
  emptyDescription = 'Link a repository to a Factory to add one.',
}: GithubIntakeCardProps) {
  // Present only when the server registers Dependabot intake alongside GitHub.
  const dependabot: IntakeSelection | undefined = config.dependabot;
  const status = statusQuery.data;
  const connected = status?.connected === true;
  const slugs = repositoriesQuery.data ?? [];
  const items = slugs.map(slug => ({ id: slug, label: slug }));
  const reposError = repositoriesQuery.isError ? "Couldn't load linked repositories." : undefined;
  // 'unavailable' means the browser's status request failed, not "not configured".
  const unavailable = statusQuery.isError || status?.reason === 'unavailable';
  return (
    <IntakeProviderCard
      name="GitHub"
      icon={<SettingsIntegrationIcon provider="github" />}
      account={status?.installations.map(installation => installation.accountLogin).join(', ')}
      listed={listed}
      connection={listed ? connected && manageButton : status?.enabled === true && connectButton}
      description={githubDescription(status, unavailable)}
      action={
        unavailable && (
          <Button
            size="sm"
            variant="ghost"
            icon={<IconArrowRotateCounterClockwise />}
            loading={statusQuery.isFetching}
            onClick={() => void statusQuery.refetch()}
          >
            Retry
          </Button>
        )
      }
    >
      {connected && (
        <>
          <SourcePicker
            label="Bring in issues from"
            addLabel="Add repository"
            itemIcon={<SettingsIntegrationIcon provider="github" />}
            groups={[{ id: 'repositories', items }]}
            selectedIds={config.github.sourceIds}
            saving={selection.saving}
            loading={repositoriesQuery.isPending}
            error={reposError}
            onRetry={() => void repositoriesQuery.refetch()}
            onToggleItem={slug => selection.update(current => toggleSource(current, slug))}
          />
          {repositoriesQuery.isSuccess && slugs.length === 0 && (
            <SettingsRow label="No linked repositories yet" description={emptyDescription} />
          )}
        </>
      )}
      {connected && dependabot && (
        <>
          <SettingsRow
            label="Dependabot alerts"
            description="Create a card for each open Dependabot alert in selected repositories."
          >
            <IntakeSyncControl
              label="Sync alerts"
              accessibleLabel="Sync Dependabot alerts"
              description="Poll selected repositories for open Dependabot alerts every 15 minutes. Cards close when the alert is fixed or dismissed."
              checked={dependabot.enabled}
              disabled={false}
              onCheckedChange={enabled => dependabotSelection.update(current => ({ ...current, enabled }))}
            />
          </SettingsRow>
          {dependabot.enabled && (
            <SourcePicker
              label="Dependabot repositories"
              addLabel="Add repository"
              itemIcon={<SettingsIntegrationIcon provider="github" />}
              groups={[{ id: 'dependabot-repositories', items }]}
              selectedIds={dependabot.sourceIds}
              saving={dependabotSelection.saving}
              loading={repositoriesQuery.isPending}
              error={reposError}
              onRetry={() => void repositoriesQuery.refetch()}
              onToggleItem={slug =>
                dependabotSelection.update(current => ({
                  ...current,
                  sourceIds: toggleSourceId(current.sourceIds, slug),
                }))
              }
            />
          )}
        </>
      )}
    </IntakeProviderCard>
  );
}

function githubDescription(status: GithubIntakeStatus | undefined, unavailable: boolean) {
  if (unavailable) return 'GitHub status could not be loaded.';
  if (status?.reason === 'auth_required') return 'Sign in again to manage GitHub issue syncing.';
  if (status?.reason === 'organization_required') return 'Select an organization to manage GitHub issue syncing.';
  if (status?.enabled !== true) return 'GitHub is not configured on this server.';
  if (!status.connected) return 'Connect GitHub to sync issues from this organization.';
  return undefined;
}
