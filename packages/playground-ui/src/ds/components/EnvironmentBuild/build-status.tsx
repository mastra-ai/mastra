import { ENVIRONMENT_BUILD_STATUS, formatEnvironmentBuildTime } from './environment-build';
import type { EnvironmentBuild, EnvironmentLastBuild } from './environment-build';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Skeleton } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';

/**
 * Build now beside the last build's live status; sits in the Template
 * subsection header. The error, when there is one, shows under the badge.
 */
export function EnvironmentBuildStatus({
  lastBuild,
  build,
  requesting,
  onBuildNow,
}: {
  lastBuild: EnvironmentLastBuild | null | undefined;
  /** Live status of `lastBuild`; undefined while it loads or when there is no last build. */
  build: EnvironmentBuild | undefined;
  requesting: boolean;
  onBuildNow: () => void;
}) {
  const active = build?.status === 'pending' || build?.status === 'building';
  const status = build ? ENVIRONMENT_BUILD_STATUS[build.status] : lastBuild ? undefined : null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        {status === undefined ? (
          <span role="status" aria-label="Loading build status">
            <Skeleton aria-hidden className="h-5 w-16 rounded-full motion-reduce:before:animate-none" />
          </span>
        ) : status ? (
          <span className="flex items-center gap-2">
            <Badge size="sm" variant={status.variant}>
              {status.label}
            </Badge>
            {lastBuild?.attemptedAt && (
              <Txt as="span" variant="meta" tone="muted">
                {formatEnvironmentBuildTime(lastBuild.attemptedAt)}
              </Txt>
            )}
          </span>
        ) : null}
        <Button size="sm" variant="primary" onClick={onBuildNow} loading={requesting || active}>
          Build now
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
