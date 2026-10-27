import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import type {
  FactoryEnvironmentBuild,
  FactoryEnvironmentBuildStatus,
  FactoryEnvironmentLastBuild,
} from '../../../workspaces/services/environment';

export const BUILD_STATUS: Record<
  FactoryEnvironmentBuildStatus,
  { label: string; variant: 'neutral' | 'success' | 'destructive' | 'warning' | 'info' }
> = {
  pending: { label: 'Pending', variant: 'info' },
  building: { label: 'Building', variant: 'info' },
  ready: { label: 'Ready', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
  unknown: { label: 'Unknown', variant: 'warning' },
};

export function formatBuildTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

/**
 * Build now beside the last build's live status; sits in the Template
 * subsection header. The error, when there is one, shows under the badge.
 */
export function BuildStatusBlock({
  lastBuild,
  build,
  requesting,
  onBuildNow,
}: {
  lastBuild: FactoryEnvironmentLastBuild | null | undefined;
  /** Live status of `lastBuild`; undefined while it loads or when there is no last build. */
  build: FactoryEnvironmentBuild | undefined;
  requesting: boolean;
  onBuildNow: () => void;
}) {
  const active = build?.status === 'pending' || build?.status === 'building';
  const status = build ? BUILD_STATUS[build.status] : lastBuild ? undefined : null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        {status === undefined ? (
          <Txt as="span" variant="meta" tone="muted">
            Loading
          </Txt>
        ) : status ? (
          <span className="flex items-center gap-2">
            <Badge size="sm" variant={status.variant}>
              {status.label}
            </Badge>
            {lastBuild?.attemptedAt && (
              <Txt as="span" variant="meta" tone="muted">
                {formatBuildTime(lastBuild.attemptedAt)}
              </Txt>
            )}
          </span>
        ) : null}
        <Button size="sm" variant="primary" disabled={requesting || active} onClick={onBuildNow}>
          {active ? 'Building...' : 'Build now'}
        </Button>
      </div>
      {build?.error && (
        <Txt as="span" font="mono" variant="meta" className="text-destructive max-w-96 truncate" title={build.error}>
          {build.error}
        </Txt>
      )}
    </div>
  );
}
