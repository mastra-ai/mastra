import type { AgentVersionLabel, ListAgentVersionsResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@mastra/playground-ui/components/Dialog';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { getAgentVersionLabelError } from '../hooks/agent-version-label-error';
import { useAgentVersionLabels } from '../hooks/use-agent-version-labels';
import {
  clearAgentVersionMutationIntegrity,
  useAgentVersionMutationIntegrity,
} from '../hooks/use-agent-version-mutation-integrity';
import type { AgentVersionIntegrityRecovery } from '../hooks/use-agent-version-mutation-integrity';
import { MoveAgentProductionDialog } from './agent-version-label-dialogs';
import type { AgentVersionLabelRefreshOptions } from './agent-version-label-dialogs';
import { AgentVersionLabelManagerContent } from './agent-version-label-manager-content';
import { useAgentVersionAccess } from '@/domains/auth/hooks/use-agent-version-access';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { useAgentVersionLabelCapabilities } from '@/domains/configuration/hooks/use-agent-version-label-capabilities';

type AgentVersionListItem = ListAgentVersionsResponse['versions'][number];

export interface AgentVersionLabelManagerProps {
  agentId: string;
  versions: readonly AgentVersionListItem[];
  activeVersionId?: string;
  isSourceProviderBacked?: boolean;
  canPublish?: boolean;
  isPublishPermissionLoading?: boolean;
  isPublishPermissionError?: boolean;
  isVersionHistoryLoading?: boolean;
  isVersionHistoryError?: boolean;
  isProductionStateError?: boolean;
  isProductionStateFetching?: boolean;
  onRetryProductionState?: (options?: AgentVersionLabelRefreshOptions) => Promise<void>;
  integrityRecovery?: AgentVersionIntegrityRecovery;
  onRefreshVersions: (options?: AgentVersionLabelRefreshOptions) => Promise<string | null>;
}

type ManagerSession = {
  canRead: boolean;
  canRenderCustomLabels: boolean;
  canRenderCustomMutations: boolean;
  canRenderProductionMutations: boolean;
};

const CLOSED_MANAGER_SESSION: ManagerSession = {
  canRead: false,
  canRenderCustomLabels: false,
  canRenderCustomMutations: false,
  canRenderProductionMutations: false,
};

export function AgentVersionLabelManager({
  agentId,
  versions,
  activeVersionId,
  isSourceProviderBacked = false,
  canPublish: canPublishProp,
  isPublishPermissionLoading,
  isPublishPermissionError,
  isVersionHistoryLoading = false,
  isVersionHistoryError = false,
  isProductionStateError = false,
  isProductionStateFetching = false,
  onRetryProductionState,
  integrityRecovery: integrityRecoveryProp,
  onRefreshVersions,
}: AgentVersionLabelManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [managerSession, setManagerSession] = useState<ManagerSession>(CLOSED_MANAGER_SESSION);
  const [openProductionTarget, setOpenProductionTarget] = useState<AgentVersionListItem>();
  const [isRetryingIntegrity, setIsRetryingIntegrity] = useState(false);
  const [integrityRetryError, setIntegrityRetryError] = useState<string>();
  const queryClient = useQueryClient();
  const capability = useAgentVersionLabelCapabilities();
  const access = useAgentVersionAccess(agentId);
  const authorizationQuery = useAuthCapabilities();
  const mutationIntegrity = useAgentVersionMutationIntegrity(agentId);
  const canPublish = canPublishProp ?? access.canPublish;
  const permissionLoading = isPublishPermissionLoading ?? access.isLoading;
  const permissionError = isPublishPermissionError ?? access.isError;
  const canReadManager = access.canRead;
  const canReadLabels = capability.supportsRead && canReadManager && !isSourceProviderBacked;
  const canMutateCustomLabels =
    canReadManager &&
    canPublish &&
    !permissionLoading &&
    !permissionError &&
    capability.supportsMutation &&
    !capability.isFetching &&
    !capability.isError &&
    !isSourceProviderBacked;
  const canMutateProduction =
    canReadManager && canPublish && !permissionLoading && !permissionError && !isProductionStateError;
  const canRenderCustomMutationsNow =
    canReadManager && canPublish && !permissionError && capability.supportsMutation && !isSourceProviderBacked;
  const canRenderProductionMutationsNow = canReadManager && canPublish && !permissionError;
  const canRenderCustomMutationActions = canRenderCustomMutationsNow || managerSession.canRenderCustomMutations;
  const canRenderProductionActions = canRenderProductionMutationsNow || managerSession.canRenderProductionMutations;
  const canRenderManagerContent = canReadManager || managerSession.canRead;
  const labelsQuery = useAgentVersionLabels({ agentId, enabled: canReadLabels && isOpen });
  const labelError = getAgentVersionLabelError(labelsQuery.error);
  const isAgentMissingOrInaccessible = labelError?.code === 'ENTITY_NOT_FOUND';
  const customMutationsDisabled =
    !canMutateCustomLabels ||
    isVersionHistoryLoading ||
    isVersionHistoryError ||
    labelsQuery.isError ||
    mutationIntegrity.isBlocked;
  const productionMutationsDisabled =
    !canMutateProduction ||
    isVersionHistoryLoading ||
    isVersionHistoryError ||
    isProductionStateFetching ||
    mutationIntegrity.isBlocked;

  if (!canReadManager && !permissionError && !isOpen) return null;

  const refreshLabels = async (options?: AgentVersionLabelRefreshOptions): Promise<readonly AgentVersionLabel[]> => {
    const result = await labelsQuery.refetch({ throwOnError: options?.throwOnError });
    return result.data?.labels ?? [];
  };

  const handleOpenChange = (nextIsOpen: boolean) => {
    setIsOpen(nextIsOpen);
    setStatus('');
    setIntegrityRetryError(undefined);
    if (!nextIsOpen) {
      setManagerSession(CLOSED_MANAGER_SESSION);
      setOpenProductionTarget(undefined);
      return;
    }
    setManagerSession({
      canRead: canReadManager,
      canRenderCustomLabels: canReadLabels,
      canRenderCustomMutations: canRenderCustomMutationsNow,
      canRenderProductionMutations: canRenderProductionMutationsNow,
    });
  };

  const handleRetryIntegrity = () => {
    setIsRetryingIntegrity(true);
    setIntegrityRetryError(undefined);
    const refreshes: Promise<unknown>[] = [onRefreshVersions({ throwOnError: true })];
    if ((canReadLabels || managerSession.canRenderCustomLabels) && !isSourceProviderBacked) {
      refreshes.push(refreshLabels({ throwOnError: true }));
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

  const internalIntegrityRecovery: AgentVersionIntegrityRecovery = {
    isBlocked: mutationIntegrity.isBlocked,
    isRetrying: isRetryingIntegrity,
    error: integrityRetryError,
    onRetry: handleRetryIntegrity,
  };
  const integrityRecovery = integrityRecoveryProp ?? internalIntegrityRecovery;

  const readOnlyDescription =
    'View label kinds and their immutable agent version targets. This view does not change labels.';
  const mutableDescription = 'Manage custom pointers and move Production between existing immutable agent versions.';

  const productionVersion = activeVersionId ? versions.find(version => version.id === activeVersionId) : undefined;
  const productionTargets =
    openProductionTarget && !versions.some(version => version.id === openProductionTarget.id)
      ? [...versions, openProductionTarget]
      : versions;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button type="button" variant="ghost" size="xs">
            Manage labels
          </Button>
        }
        disabled={isVersionHistoryError}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage version labels</DialogTitle>
          <DialogDescription>
            {canRenderCustomMutationActions || canRenderProductionActions ? mutableDescription : readOnlyDescription}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-6">
          {permissionError && !canRenderManagerContent ? (
            <div className="flex flex-col items-start gap-2" role="alert">
              <p className="text-ui-sm text-neutral4">
                Version-label permissions are unavailable. Mutation controls stay disabled until access is checked.
              </p>
              <Button type="button" variant="default" size="sm" onClick={() => void authorizationQuery.refetch()}>
                Retry permissions
              </Button>
            </div>
          ) : access.isLoading && !canRenderManagerContent ? (
            <p className="text-ui-sm text-neutral4" role="status">
              Checking version-label permissions&hellip;
            </p>
          ) : !canRenderManagerContent ? (
            <p className="text-ui-sm text-neutral4" role="alert">
              Stored-agent read access is required to view version labels.
            </p>
          ) : isAgentMissingOrInaccessible ? (
            <p className="text-ui-sm text-neutral4" role="alert">
              Agent missing or inaccessible.
            </p>
          ) : (
            <>
              {permissionLoading || permissionError || !canReadManager ? (
                <div className="flex flex-col items-start gap-2" role="alert">
                  <p className="text-ui-sm text-neutral4">
                    {permissionError
                      ? 'Version-label permissions are unavailable. Mutation controls stay disabled until access is checked. Existing dialog input is preserved.'
                      : permissionLoading
                        ? 'Version-label permissions are being rechecked. Existing dialog input is preserved, and mutation controls stay disabled until access is verified.'
                        : 'Stored-agent read access is required to view version labels. Existing dialog input is preserved, and mutation controls stay disabled.'}
                  </p>
                  {permissionError ? (
                    <Button type="button" variant="default" size="sm" onClick={() => void authorizationQuery.refetch()}>
                      Retry permissions
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <div hidden={!canReadManager}>
                <div className="flex flex-col gap-6">
                  {isVersionHistoryLoading ? (
                    <p className="text-ui-sm text-neutral4" role="status">
                      Version history is loading. Label and Production changes remain disabled until it completes.
                    </p>
                  ) : isVersionHistoryError ? (
                    <p className="text-ui-sm text-neutral4" role="alert">
                      Version history could not be verified. Label and Production changes are disabled until it
                      recovers.
                    </p>
                  ) : null}
                  <section aria-labelledby="custom-labels-heading" className="flex flex-col gap-3">
                    <h3 id="custom-labels-heading" className="text-ui-sm text-neutral5 font-medium">
                      Custom labels
                    </h3>
                    {isSourceProviderBacked ? (
                      <p className="text-ui-sm text-neutral3">
                        Custom labels are not supported for this source-provider-backed agent in Studio.
                      </p>
                    ) : (
                      <>
                        {capability.isLoading || capability.isFetching ? (
                          <p className="text-ui-sm text-neutral3" role="status">
                            Checking custom-label support&hellip;
                          </p>
                        ) : capability.isError ? (
                          <div className="flex flex-col items-start gap-2" role="alert">
                            <p className="text-ui-sm text-neutral3">Custom-label support is unavailable.</p>
                            <Button type="button" variant="default" size="sm" onClick={() => void capability.refetch()}>
                              Retry support check
                            </Button>
                          </div>
                        ) : !capability.supportsRead ? (
                          <p className="text-ui-sm text-neutral3">
                            Custom labels are not supported by this storage adapter. Production can still be managed
                            when publishing is allowed.
                          </p>
                        ) : null}
                        {capability.supportsRead || managerSession.canRenderCustomLabels ? (
                          <div hidden={!capability.supportsRead}>
                            <AgentVersionLabelManagerContent
                              labels={labelsQuery.data?.labels ?? []}
                              isLoading={labelsQuery.isLoading}
                              isError={labelsQuery.isError && !labelsQuery.data}
                              isStaleError={labelsQuery.isError && Boolean(labelsQuery.data)}
                              onRetry={() => void labelsQuery.refetch()}
                              agentId={agentId}
                              versions={versions}
                              canMutate={canRenderCustomMutationActions}
                              mutationsDisabled={customMutationsDisabled}
                              integrityRecovery={integrityRecovery}
                              onRefreshLabels={refreshLabels}
                              onRefreshVersions={onRefreshVersions}
                              onStatus={setStatus}
                            />
                          </div>
                        ) : null}
                      </>
                    )}
                    {capability.supportsRead && !capability.supportsMutation && !capability.isLoading ? (
                      <p className="text-ui-sm text-neutral3">
                        Custom labels are read-only because this adapter does not provide every required write,
                        compare-and-swap, and retention-protection capability.
                      </p>
                    ) : null}
                  </section>

                  <section
                    aria-labelledby="production-heading"
                    className="border-border1 flex flex-col gap-3 border-t pt-5"
                  >
                    <div className="flex flex-col gap-1">
                      <h3 id="production-heading" className="text-ui-sm text-neutral5 font-medium">
                        Production
                      </h3>
                      {isVersionHistoryLoading ? (
                        <p className="text-ui-sm text-neutral3" role="status">
                          Production state will be shown after version history loads.
                        </p>
                      ) : isProductionStateError ? (
                        <div className="flex flex-col items-start gap-2" role="alert">
                          <p className="text-ui-sm text-neutral3">
                            Production state could not be verified. Production changes remain disabled.
                          </p>
                          {onRetryProductionState ? (
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={() => {
                                void onRetryProductionState({ throwOnError: true }).catch(() => undefined);
                              }}
                              disabled={isProductionStateFetching}
                            >
                              {isProductionStateFetching ? 'Retrying Production state\u2026' : 'Retry Production state'}
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-ui-sm text-neutral3">
                          {productionVersion
                            ? `Production currently points to v${productionVersion.versionNumber}.`
                            : 'No Production version is set.'}
                        </p>
                      )}
                    </div>
                    {productionTargets.length === 0 && !isVersionHistoryLoading ? (
                      <p className="text-ui-sm text-neutral3">Save a version before managing labels or Production.</p>
                    ) : canRenderProductionActions ? (
                      <div className="flex flex-col items-stretch gap-2 sm:items-start">
                        {productionTargets.map(version => (
                          <MoveAgentProductionDialog
                            key={version.id}
                            agentId={agentId}
                            version={version}
                            versions={versions}
                            activeVersionId={activeVersionId}
                            onRefreshVersions={onRefreshVersions}
                            onStatus={setStatus}
                            disabled={productionMutationsDisabled}
                            integrityRecovery={integrityRecovery}
                            onOpenChange={open => setOpenProductionTarget(open ? version : undefined)}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-ui-sm text-neutral3">Publishing access is required to move Production.</p>
                    )}
                  </section>
                </div>
              </div>
            </>
          )}
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {status}
          </p>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
