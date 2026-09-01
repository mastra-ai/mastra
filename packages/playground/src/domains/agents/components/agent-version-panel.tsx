import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useAgentVersionLabels } from '../hooks/use-agent-version-labels';
import {
  clearAgentVersionMutationIntegrity,
  useAgentVersionMutationIntegrity,
} from '../hooks/use-agent-version-mutation-integrity';
import type { AgentVersionIntegrityRecovery } from '../hooks/use-agent-version-mutation-integrity';
import { useAllAgentVersions } from '../hooks/use-agent-versions';
import { AgentVersionLabelBadges } from './agent-version-label-badges';
import { CreateAgentVersionLabelDialog } from './agent-version-label-dialogs';
import type { AgentVersionLabelRefreshOptions } from './agent-version-label-dialogs';
import { AgentVersionLabelManager } from './agent-version-label-manager';
import { useAgentVersionAccess } from '@/domains/auth/hooks/use-agent-version-access';
import { useAgentVersionLabelCapabilities } from '@/domains/configuration/hooks/use-agent-version-label-capabilities';

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface AgentVersionPanelProps {
  agentId: string;
  selectedVersionId?: string;
  onVersionSelect: (versionId: string) => void;
  activeVersionId?: string;
  isSourceProviderBacked?: boolean;
  canPublish?: boolean;
  isPublishPermissionLoading?: boolean;
  isPublishPermissionError?: boolean;
  isProductionStateError?: boolean;
  isProductionStateFetching?: boolean;
  onRetryProductionState?: (options?: AgentVersionLabelRefreshOptions) => Promise<void>;
}

function VersionHistoryError({ hasCachedData, onRetry }: { hasCachedData: boolean; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 px-3 py-4" role="alert">
      <Txt variant="ui-xs" className={hasCachedData ? 'text-warning' : 'text-neutral3'}>
        {hasCachedData
          ? 'Version history may be out of date. Showing the last verified versions.'
          : 'Couldn\u2019t load version history.'}
      </Txt>
      <Button type="button" variant="default" size="xs" onClick={onRetry}>
        Retry version history
      </Button>
    </div>
  );
}

export function AgentVersionPanel({
  agentId,
  selectedVersionId,
  onVersionSelect,
  activeVersionId,
  isSourceProviderBacked = false,
  canPublish,
  isPublishPermissionLoading,
  isPublishPermissionError,
  isProductionStateError = false,
  isProductionStateFetching = false,
  onRetryProductionState,
}: AgentVersionPanelProps) {
  const [status, setStatus] = useState('');
  const [isRetryingIntegrity, setIsRetryingIntegrity] = useState(false);
  const [integrityRetryError, setIntegrityRetryError] = useState<string>();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useAllAgentVersions({
    agentId,
    params: { orderBy: { direction: 'DESC' } },
  });
  const access = useAgentVersionAccess(agentId);
  const capability = useAgentVersionLabelCapabilities();
  const mutationIntegrity = useAgentVersionMutationIntegrity(agentId);
  const resolvedCanPublish = canPublish ?? access.canPublish;
  const permissionLoading = isPublishPermissionLoading ?? access.isLoading;
  const permissionError = isPublishPermissionError ?? access.isError;
  const canCreateFromRow =
    access.canRead &&
    resolvedCanPublish &&
    !permissionLoading &&
    !permissionError &&
    !isError &&
    capability.supportsMutation &&
    !isSourceProviderBacked;
  const rowLabelsQuery = useAgentVersionLabels({ agentId, enabled: canCreateFromRow });

  const versions = data?.versions ?? [];
  const hasCachedVersionHistory = data !== undefined;

  const activeVersion = activeVersionId ? versions.find(v => v.id === activeVersionId) : undefined;
  const activeVersionNumber = activeVersion?.versionNumber;
  const refreshVersions = useCallback(
    async (options?: AgentVersionLabelRefreshOptions): Promise<string | null> => {
      const result = await refetch({ throwOnError: options?.throwOnError });
      return result.data?.versions.find(version => version.labels?.includes('production'))?.id ?? null;
    },
    [refetch],
  );
  const refreshRowLabels = useCallback(
    async (options?: AgentVersionLabelRefreshOptions) => {
      const result = await rowLabelsQuery.refetch({ throwOnError: options?.throwOnError });
      return result.data?.labels ?? [];
    },
    [rowLabelsQuery],
  );
  const handleRetryIntegrity = () => {
    setIsRetryingIntegrity(true);
    setIntegrityRetryError(undefined);
    const refreshes: Promise<unknown>[] = [refreshVersions({ throwOnError: true })];
    if (rowLabelsQuery.data) {
      refreshes.push(refreshRowLabels({ throwOnError: true }));
    }
    if (onRetryProductionState) {
      refreshes.push(onRetryProductionState({ throwOnError: true }));
    }
    void Promise.all(refreshes)
      .then(() => {
        clearAgentVersionMutationIntegrity(queryClient, agentId);
        setStatus('Verified version-label state refreshed. Review the preserved intent before retrying.');
      })
      .catch(() => {
        setIntegrityRetryError(
          'Studio couldn\u2019t refresh verified version-label state. Retry again; if the problem persists, contact support.',
        );
      })
      .finally(() => setIsRetryingIntegrity(false));
  };
  const integrityRecovery: AgentVersionIntegrityRecovery = {
    isBlocked: mutationIntegrity.isBlocked,
    isRetrying: isRetryingIntegrity,
    error: integrityRetryError,
    onRetry: handleRetryIntegrity,
  };
  const canRenderRowMutation = !isSourceProviderBacked && rowLabelsQuery.data !== undefined;
  const rowMutationsDisabled = !canCreateFromRow || rowLabelsQuery.isError || mutationIntegrity.isBlocked;

  return (
    <div className="flex h-full flex-col">
      <div className="border-border1 flex min-w-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-3">
        <Txt variant="ui-sm" className="text-neutral5 font-medium">
          Version history
        </Txt>
        <AgentVersionLabelManager
          agentId={agentId}
          versions={versions}
          activeVersionId={activeVersionId}
          isSourceProviderBacked={isSourceProviderBacked}
          canPublish={canPublish}
          isPublishPermissionLoading={isPublishPermissionLoading}
          isPublishPermissionError={isPublishPermissionError}
          isVersionHistoryLoading={isLoading}
          isVersionHistoryError={isError}
          isProductionStateError={isProductionStateError}
          isProductionStateFetching={isProductionStateFetching}
          onRetryProductionState={onRetryProductionState}
          onRefreshVersions={refreshVersions}
        />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {isLoading ? (
          <div className="px-3 py-4">
            <Txt variant="ui-xs" className="text-neutral2">
              Loading versions...
            </Txt>
          </div>
        ) : isError && !hasCachedVersionHistory ? (
          <VersionHistoryError hasCachedData={false} onRetry={() => void refetch()} />
        ) : versions.length === 0 ? (
          <>
            {isError ? <VersionHistoryError hasCachedData onRetry={() => void refetch()} /> : null}
            <div className="px-3 py-4" role="status">
              <Txt variant="ui-xs" className="text-neutral2">
                No saved versions yet.
              </Txt>
            </div>
          </>
        ) : (
          <>
            {isError ? <VersionHistoryError hasCachedData onRetry={() => void refetch()} /> : null}
            <ul className="flex flex-col">
              {versions.map(version => {
                const isSelected =
                  selectedVersionId === version.id || (!selectedVersionId && version.id === versions[0]?.id);
                const isDraft = activeVersionNumber !== undefined && version.versionNumber > activeVersionNumber;

                return (
                  <li
                    key={version.id}
                    className={cn(
                      'border-l-2 transition-colors',
                      isSelected
                        ? 'bg-surface2 text-neutral5 border-accent1'
                        : 'border-transparent text-neutral3 hover:bg-surface3 hover:text-neutral5',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onVersionSelect(version.id)}
                      aria-current={isSelected ? 'true' : undefined}
                      className="w-full px-3 pt-2.5 text-left text-sm"
                    >
                      <Txt variant="ui-sm" className="text-inherit">
                        v{version.versionNumber}
                      </Txt>
                      <Txt variant="ui-xs" className="text-neutral2 mt-0.5">
                        {formatTimestamp(version.createdAt)}
                      </Txt>
                      {version.changeMessage ? (
                        <Txt variant="ui-xs" className="text-neutral3 mt-1 wrap-anywhere">
                          {version.changeMessage}
                        </Txt>
                      ) : null}
                    </button>
                    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1 px-3 pt-1 pb-2.5">
                      <AgentVersionLabelBadges labels={version.labels} versionNumber={version.versionNumber} />
                      {isDraft && (
                        <Badge size="xs" variant="warning">
                          Draft
                        </Badge>
                      )}
                      {canRenderRowMutation && rowLabelsQuery.data ? (
                        <CreateAgentVersionLabelDialog
                          agentId={agentId}
                          versions={versions}
                          labels={rowLabelsQuery.data.labels}
                          initialVersionId={version.id}
                          isRowAction
                          onRefreshLabels={refreshRowLabels}
                          onRefreshVersions={refreshVersions}
                          onStatus={setStatus}
                          disabled={rowMutationsDisabled}
                          integrityRecovery={integrityRecovery}
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </ScrollArea>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {status}
      </p>
    </div>
  );
}
