import { Button } from '@mastra/playground-ui/components/Button';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import type { UseQueryResult } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import type { FactoryProject, GithubStatus } from '../../workspaces/services/github';
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
  factories,
  statusQuery,
  loading,
  error,
  onRetry,
}: IntakeSectionProps & {
  factories: FactoryProject[];
  statusQuery: UseQueryResult<GithubStatus>;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const status = statusQuery.data;
  const connected = status?.connected === true;
  const githubFactories = factories.filter(factory =>
    factory.repositories.some(repository => repository.provider !== 'gitlab'),
  );
  const slugs = [
    ...new Set(
      githubFactories.flatMap(factory =>
        factory.repositories.filter(repository => repository.provider !== 'gitlab').map(repository => repository.slug),
      ),
    ),
  ];
  const unavailable = statusQuery.isError || status?.reason === 'unavailable';
  const description = unavailable
    ? 'GitHub status could not be loaded.'
    : githubDescription(status?.reason, statusQuery.isPending, status?.enabled === true, connected);
  return (
    <IntakeProviderCard
      name="GitHub"
      icon={<SettingsIntegrationIcon provider="github" />}
      account={status?.installations.map(installation => installation.accountLogin).join(', ')}
      connected={connected || Boolean(status?.installations.length) || unavailable || statusQuery.isPending}
      connectable={status?.enabled === true}
      description={description}
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
            disabled={busy}
            pending={busy}
            loading={loading}
            error={error ? "Couldn't load linked repositories." : undefined}
            onRetry={onRetry}
            onToggleItem={slug =>
              update({
                ...config,
                github: { ...config.github, sourceIds: toggleSourceId(config.github.sourceIds, slug) },
              })
            }
          />
          {!loading && !error && slugs.length === 0 && (
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

function githubDescription(reason: string | undefined, pending: boolean, enabled: boolean, connected: boolean) {
  if (pending) return 'Checking the GitHub connection…';
  if (reason === 'auth_required') return 'Sign in again to manage GitHub issue syncing.';
  if (reason === 'organization_required') return 'Select an organization to manage GitHub issue syncing.';
  if (!enabled) return 'GitHub is not configured on this server.';
  if (!connected) return 'Connect GitHub to sync issues from this organization.';
  return undefined;
}
