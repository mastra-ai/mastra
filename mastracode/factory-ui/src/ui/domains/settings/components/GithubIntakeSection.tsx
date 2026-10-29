import { Button } from '@mastra/playground-ui/components/Button';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import type { UseQueryResult } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { useFactoriesQuery } from '../../../../hooks/useFactories';
import type { GithubStatus } from '../../workspaces/services/github';
import { unavailableInstallNotice } from '../../workspaces/services/github';
import { GithubLabelRouting } from './GithubLabelRouting';
import { IntakeProviderCard, toggleSourceId } from './IntakeProviderCard';
import type { IntakeSectionProps } from './IntakeProviderCard';
import { SourcePicker } from './IntakeSourcePicker';
import { SettingsIntegrationIcon } from './brand-icons/SettingsIntegrationIcon';
import { IntakeSyncControl } from './common/IntakeSyncControl';

export function GithubIntakeSection({
  config,
  busy,
  update,
  listed,
  statusQuery,
}: IntakeSectionProps & { statusQuery: UseQueryResult<GithubStatus> }) {
  const factoriesQuery = useFactoriesQuery();
  const status = statusQuery.data;
  const connected = status?.connected === true;
  const githubFactories = (factoriesQuery.data ?? []).filter(factory =>
    factory.repositories.some(repository => repository.provider !== 'gitlab'),
  );
  const slugs = [
    ...new Set(
      githubFactories.flatMap(factory =>
        factory.repositories.filter(repository => repository.provider !== 'gitlab').map(repository => repository.slug),
      ),
    ),
  ];
  // 'unavailable' means the browser's status request failed, not "not configured".
  const unavailable = statusQuery.isError || status?.reason === 'unavailable';
  return (
    <IntakeProviderCard
      name="GitHub"
      icon={<SettingsIntegrationIcon provider="github" />}
      account={status?.installations.map(installation => installation.accountLogin).join(', ')}
      listed={listed}
      connectable={status?.enabled === true}
      description={githubDescription(status, unavailable)}
      syncControl={
        <IntakeSyncControl
          accessibleLabel="Sync GitHub issues"
          description="Import open issues from selected repositories."
          checked={config.github.enabled}
          disabled={busy || !connected}
          onCheckedChange={enabled => update({ ...config, github: { ...config.github, enabled } })}
        />
      }
      action={
        unavailable && (
          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCcw />}
            disabled={statusQuery.isFetching}
            onClick={() => void statusQuery.refetch()}
          >
            Retry
          </Button>
        )
      }
    >
      {connected && config.github.enabled && (
        <>
          <SourcePicker
            label="Repositories"
            addLabel="Add repository"
            itemIcon={<SettingsIntegrationIcon provider="github" />}
            groups={[{ id: 'repositories', items: slugs.map(slug => ({ id: slug, label: slug })) }]}
            selectedIds={config.github.sourceIds}
            pending={busy}
            loading={factoriesQuery.isPending}
            error={factoriesQuery.isError ? "Couldn't load linked repositories." : undefined}
            onRetry={() => void factoriesQuery.refetch()}
            onToggleItem={slug =>
              update({
                ...config,
                github: { ...config.github, sourceIds: toggleSourceId(config.github.sourceIds, slug) },
              })
            }
          />
          {factoriesQuery.isSuccess && slugs.length === 0 && (
            <SettingsRow label="No linked repositories yet" description="Link a repository to a Factory to add one." />
          )}
          {slugs.length > 0 &&
            githubFactories.map(factory => (
              <GithubLabelRouting
                key={factory.id}
                factoryProjectId={factory.id}
                name={factory.name}
                showScope={githubFactories.length > 1}
                repositories={factory.repositories
                  .filter(repository => repository.provider !== 'gitlab')
                  .map(repository => repository.slug)}
              />
            ))}
        </>
      )}
    </IntakeProviderCard>
  );
}

function githubDescription(status: GithubStatus | undefined, unavailable: boolean) {
  if (unavailable) return 'GitHub status could not be loaded.';
  if (status?.reason === 'auth_required') return 'Sign in again to manage GitHub issue syncing.';
  if (status?.reason === 'organization_required') return 'Select an organization to manage GitHub issue syncing.';
  if (status?.enabled !== true) return 'GitHub is not configured on this server.';
  if (!status.connected) {
    return unavailableInstallNotice(status)?.message ?? 'Connect GitHub to sync issues from this organization.';
  }
  return undefined;
}
