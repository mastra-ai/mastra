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
import { useState } from 'react';

import { getAgentVersionLabelError } from '../hooks/agent-version-label-error';
import { useAgentVersionLabels } from '../hooks/use-agent-version-labels';
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
  isVersionHistoryError?: boolean;
  onRefreshVersions: (options?: AgentVersionLabelRefreshOptions) => Promise<string | null>;
}

export function AgentVersionLabelManager({
  agentId,
  versions,
  activeVersionId,
  isSourceProviderBacked = false,
  canPublish: canPublishProp,
  isPublishPermissionLoading,
  isPublishPermissionError,
  isVersionHistoryError = false,
  onRefreshVersions,
}: AgentVersionLabelManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState('');
  const capability = useAgentVersionLabelCapabilities();
  const access = useAgentVersionAccess(agentId);
  const authorizationQuery = useAuthCapabilities();
  const canPublish = canPublishProp ?? access.canPublish;
  const permissionLoading = isPublishPermissionLoading ?? access.isLoading;
  const permissionError = isPublishPermissionError ?? access.isError;
  const canReadManager = access.canRead;
  const canReadLabels = capability.supportsRead && canReadManager && !isSourceProviderBacked;
  const canRenderCustomMutationActions =
    canReadManager && canPublish && capability.supportsMutation && !isSourceProviderBacked;
  const canRenderProductionActions = canReadManager && canPublish;
  const labelsQuery = useAgentVersionLabels({ agentId, enabled: canReadLabels && isOpen });
  const labelError = getAgentVersionLabelError(labelsQuery.error);
  const isAgentMissingOrInaccessible = labelError?.code === 'ENTITY_NOT_FOUND';
  const customMutationsDisabled = permissionLoading || permissionError || isVersionHistoryError || labelsQuery.isError;
  const productionMutationsDisabled = permissionLoading || permissionError || isVersionHistoryError;

  if (!canReadManager && !permissionError && !isOpen) return null;

  const refreshLabels = async (options?: AgentVersionLabelRefreshOptions): Promise<readonly AgentVersionLabel[]> => {
    const result = await labelsQuery.refetch({ throwOnError: options?.throwOnError });
    return result.data?.labels ?? [];
  };

  const readOnlyDescription =
    'View label kinds and their immutable agent version targets. This view does not change labels.';
  const mutableDescription = 'Manage custom pointers and move Production between existing immutable agent versions.';

  const productionVersion = activeVersionId ? versions.find(version => version.id === activeVersionId) : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
          {permissionError ? (
            <div className="flex flex-col items-start gap-2" role="alert">
              <p className="text-ui-sm text-neutral4">
                Version-label permissions are unavailable. Mutation controls stay disabled until access is checked.
              </p>
              <Button type="button" variant="default" size="sm" onClick={() => void authorizationQuery.refetch()}>
                Retry permissions
              </Button>
            </div>
          ) : access.isLoading ? (
            <p className="text-ui-sm text-neutral4" role="status">
              Checking version-label permissions&hellip;
            </p>
          ) : !canReadManager ? (
            <p className="text-ui-sm text-neutral4" role="alert">
              Stored-agent read access is required to view version labels.
            </p>
          ) : isAgentMissingOrInaccessible ? (
            <p className="text-ui-sm text-neutral4" role="alert">
              Agent missing or inaccessible.
            </p>
          ) : (
            <>
              {isVersionHistoryError ? (
                <p className="text-ui-sm text-neutral4" role="alert">
                  Version history could not be verified. Label and Production changes are disabled until it recovers.
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
                ) : capability.isLoading ? (
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
                ) : capability.supportsRead ? (
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
                    onRefreshLabels={refreshLabels}
                    onRefreshVersions={onRefreshVersions}
                    onStatus={setStatus}
                  />
                ) : (
                  <p className="text-ui-sm text-neutral3">
                    Custom labels are not supported by this storage adapter. Production can still be managed when
                    publishing is allowed.
                  </p>
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
                  <p className="text-ui-sm text-neutral3">
                    {productionVersion
                      ? `Production currently points to v${productionVersion.versionNumber}.`
                      : 'No Production version is set.'}
                  </p>
                </div>
                {versions.length === 0 ? (
                  <p className="text-ui-sm text-neutral3">Save a version before managing labels or Production.</p>
                ) : canRenderProductionActions ? (
                  <div className="flex flex-col items-stretch gap-2 sm:items-start">
                    {versions.map(version => (
                      <MoveAgentProductionDialog
                        key={version.id}
                        agentId={agentId}
                        version={version}
                        versions={versions}
                        activeVersionId={activeVersionId}
                        onRefreshVersions={onRefreshVersions}
                        onStatus={setStatus}
                        disabled={productionMutationsDisabled}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-ui-sm text-neutral3">Publishing access is required to move Production.</p>
                )}
              </section>
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
