import type { AgentVersionLabel, ListAgentVersionsResponse } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';

import {
  CreateAgentVersionLabelDialog,
  DeleteAgentVersionLabelDialog,
  MoveAgentVersionLabelDialog,
} from './agent-version-label-dialogs';
import type { AgentVersionLabelRefreshOptions } from './agent-version-label-dialogs';

type AgentVersionListItem = ListAgentVersionsResponse['versions'][number];

function compareAscii(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function getLabelRank(label: AgentVersionLabel): number {
  if (label.kind === 'production') return 0;
  if (label.kind === 'custom') return 1;
  return 2;
}

function orderLabels(labels: readonly AgentVersionLabel[]): AgentVersionLabel[] {
  return [...labels].sort((left, right) => {
    const rankDifference = getLabelRank(left) - getLabelRank(right);
    if (rankDifference !== 0) return rankDifference;
    return compareAscii(left.name, right.name);
  });
}

function formatLabelKind(kind: AgentVersionLabel['kind']): 'Production' | 'Custom' | 'Latest' {
  if (kind === 'production') return 'Production';
  if (kind === 'custom') return 'Custom';
  return 'Latest';
}

function getKindVariant(kind: AgentVersionLabel['kind']): 'success' | 'default' | 'info' {
  if (kind === 'production') return 'success';
  if (kind === 'custom') return 'default';
  return 'info';
}

function shortenVersionId(versionId: string): string {
  if (versionId.length <= 13) return versionId;
  return `${versionId.slice(0, 8)}…${versionId.slice(-4)}`;
}

function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface AgentVersionLabelManagerContentProps {
  labels: readonly AgentVersionLabel[];
  isLoading: boolean;
  isError: boolean;
  isStaleError?: boolean;
  onRetry: () => void;
  agentId?: string;
  versions?: readonly AgentVersionListItem[];
  canMutate?: boolean;
  mutationsDisabled?: boolean;
  onRefreshLabels?: (options?: AgentVersionLabelRefreshOptions) => Promise<readonly AgentVersionLabel[]>;
  onRefreshVersions?: (options?: AgentVersionLabelRefreshOptions) => Promise<string | null>;
  onStatus?: (message: string) => void;
}

export function AgentVersionLabelManagerContent({
  labels,
  isLoading,
  isError,
  isStaleError = false,
  onRetry,
  agentId,
  versions = [],
  canMutate = false,
  mutationsDisabled = false,
  onRefreshLabels,
  onRefreshVersions,
  onStatus,
}: AgentVersionLabelManagerContentProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3" role="status">
        <Spinner className="size-4" />
        <Txt variant="ui-sm">Loading labels&hellip;</Txt>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 py-2" role="alert">
        <Txt variant="ui-sm">Couldn&rsquo;t load version labels.</Txt>
        <Button type="button" variant="default" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  const orderedLabels = orderLabels(labels);
  const hasCustomLabels = orderedLabels.some(label => label.kind === 'custom');
  const canRenderMutationActions =
    canMutate && Boolean(agentId) && Boolean(onRefreshLabels) && Boolean(onRefreshVersions) && Boolean(onStatus);
  const canCreateLabel = canRenderMutationActions && versions.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {isStaleError ? (
        <div className="flex flex-wrap items-center justify-between gap-2" role="alert">
          <Txt variant="ui-sm">Couldn&rsquo;t refresh version labels. Showing the last saved result.</Txt>
          <Button type="button" variant="default" size="sm" onClick={onRetry}>
            Retry label refresh
          </Button>
        </div>
      ) : null}

      {canCreateLabel && agentId && onRefreshLabels && onRefreshVersions && onStatus ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Txt variant="ui-sm" className="font-medium">
            Custom labels
          </Txt>
          <CreateAgentVersionLabelDialog
            agentId={agentId}
            versions={versions}
            labels={labels}
            onRefreshLabels={onRefreshLabels}
            onRefreshVersions={onRefreshVersions}
            onStatus={onStatus}
            disabled={mutationsDisabled}
          />
        </div>
      ) : null}

      {!hasCustomLabels && versions.length > 0 ? (
        <Txt variant="ui-sm">
          No custom labels yet. Custom labels are movable release channels that can point to any saved version.
        </Txt>
      ) : null}

      {orderedLabels.length === 0 ? (
        <Txt variant="ui-sm">No version labels found.</Txt>
      ) : (
        <ul aria-label="Agent version labels" className="flex flex-col gap-4">
          {orderedLabels.map(label => (
            <li key={label.name} className="flex min-w-0 flex-col gap-2">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Txt variant="ui-sm" className="min-w-0 wrap-anywhere">
                    {label.name}
                  </Txt>
                  <Badge size="xs" variant={getKindVariant(label.kind)}>
                    {formatLabelKind(label.kind)}
                  </Badge>
                </div>
                {canRenderMutationActions &&
                label.kind === 'custom' &&
                agentId &&
                onRefreshLabels &&
                onRefreshVersions &&
                onStatus ? (
                  <div className="flex items-center gap-1">
                    <MoveAgentVersionLabelDialog
                      agentId={agentId}
                      label={label}
                      versions={versions}
                      onRefreshLabels={onRefreshLabels}
                      onRefreshVersions={onRefreshVersions}
                      onStatus={onStatus}
                      disabled={mutationsDisabled}
                    />
                    <DeleteAgentVersionLabelDialog
                      agentId={agentId}
                      label={label}
                      versions={versions}
                      onRefreshLabels={onRefreshLabels}
                      onRefreshVersions={onRefreshVersions}
                      onStatus={onStatus}
                      disabled={mutationsDisabled}
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Txt variant="ui-sm">v{label.versionNumber}</Txt>
                <Badge size="sm" title={label.versionId} className="min-w-0">
                  <span className="truncate">{shortenVersionId(label.versionId)}</span>
                </Badge>
                <CopyButton
                  content={label.versionId}
                  tooltip={`Copy version ID for ${label.name} at v${label.versionNumber}`}
                  size="icon-xs"
                  variant="ghost"
                />
              </div>
              {label.updatedAt ? <Txt variant="ui-xs">Updated {formatTimestamp(label.updatedAt)}</Txt> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
