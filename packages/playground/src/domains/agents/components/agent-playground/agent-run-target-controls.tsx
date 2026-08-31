import type { AgentVersionLabel, ListAgentVersionsResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { ComposerRunOptions } from '../composer-run-options';
import type { AgentExecutionTarget } from './agent-execution-target';
import { AgentExecutionTargetSelect } from './agent-execution-target-select';
import { AgentRunVersionIdentity } from './agent-run-version-identity';

interface AgentRunTargetControlsProps {
  target: AgentExecutionTarget;
  labels: AgentVersionLabel[];
  versions: ListAgentVersionsResponse['versions'];
  isAvailable: boolean;
  isLoading: boolean;
  isLabelDataStale?: boolean;
  hasLabelIntegrityError?: boolean;
  isRetryingLabels?: boolean;
  isRetryingIntegrity?: boolean;
  hasVersionHistoryError?: boolean;
  isRetryingVersions?: boolean;
  requestContextSchema?: string;
  onTargetChange: (target: AgentExecutionTarget) => void;
  onRetryLabels?: () => void;
  onRetryIntegrity?: () => Promise<void>;
  onRetryVersions?: () => void | Promise<void>;
}

function getSelectedTargetName(
  target: AgentExecutionTarget,
  labels: AgentVersionLabel[],
  versions: ListAgentVersionsResponse['versions'],
): string {
  if (target.kind === 'version') {
    const version = versions.find(candidate => candidate.id === target.versionId);
    return version ? `v${version.versionNumber}` : `exact version ${target.versionId}`;
  }

  const label = labels.find(candidate => candidate.name === target.label);
  const labeledVersion = versions.find(candidate => candidate.labels?.includes(target.label));
  const versionNumber = label?.versionNumber ?? labeledVersion?.versionNumber;
  return versionNumber === undefined ? target.label : `${target.label} · v${versionNumber}`;
}

export function AgentRunTargetControls({
  target,
  labels,
  versions,
  isAvailable,
  isLoading,
  isLabelDataStale = false,
  hasLabelIntegrityError = false,
  isRetryingLabels = false,
  isRetryingIntegrity = false,
  hasVersionHistoryError = false,
  isRetryingVersions = false,
  requestContextSchema,
  onTargetChange,
  onRetryLabels,
  onRetryIntegrity,
  onRetryVersions,
}: AgentRunTargetControlsProps) {
  const selectedTargetName = getSelectedTargetName(target, labels, versions);

  return (
    <div className="flex max-w-full flex-col items-start gap-1.5">
      <div className="flex max-w-full flex-wrap items-center gap-1.5">
        <AgentExecutionTargetSelect
          target={target}
          labels={labels}
          versions={versions}
          isAvailable={isAvailable}
          isLoading={isLoading}
          onTargetChange={onTargetChange}
        />
        <AgentRunVersionIdentity versions={versions} />
        <ComposerRunOptions requestContextSchema={requestContextSchema} />
      </div>
      {isLabelDataStale ? (
        <div className="flex flex-wrap items-center gap-2" role="alert">
          <Txt variant="ui-xs" className="text-warning">
            Version labels may be out of date. Studio is keeping the last verified targets.
          </Txt>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onRetryLabels}
            disabled={!onRetryLabels || isRetryingLabels}
            aria-label={`Retry version labels for ${selectedTargetName}`}
          >
            {isRetryingLabels ? 'Retrying version labels…' : 'Retry version labels'}
          </Button>
        </div>
      ) : null}
      {hasLabelIntegrityError ? (
        <div className="flex flex-col items-start gap-1.5" role="alert">
          <div>
            <Txt variant="ui-xs" className="text-warning">
              Version-label integrity could not be verified. Custom labels are unavailable; Production, Latest, and
              exact versions remain available.
            </Txt>
            <Txt variant="ui-xs" className="text-neutral3">
              Retry labels and version history. If the problem continues, contact support.
            </Txt>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => void onRetryIntegrity?.()}
            disabled={!onRetryIntegrity || isRetryingIntegrity}
            aria-label={`Retry version data for ${selectedTargetName}`}
          >
            {isRetryingIntegrity ? 'Retrying version data…' : 'Retry version data'}
          </Button>
        </div>
      ) : null}
      {hasVersionHistoryError ? (
        <div className="flex flex-wrap items-center gap-2" role="alert">
          <Txt variant="ui-xs" className="text-warning">
            Version history may be out of date. New runs are disabled until it refreshes.
          </Txt>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => void onRetryVersions?.()}
            disabled={!onRetryVersions || isRetryingVersions}
            aria-label={`Retry version history for ${selectedTargetName}`}
          >
            {isRetryingVersions ? 'Retrying version history…' : 'Retry version history'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
