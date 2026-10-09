import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';

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
 * The last build: its live status from the provider, when it was asked for,
 * the template sessions boot from, what went wrong, and Build now.
 */
export function BuildStatusBlock({
  lastBuild,
  build,
  activeTemplateId,
  requesting,
  onBuildNow,
}: {
  lastBuild: FactoryEnvironmentLastBuild | null | undefined;
  /** Live status of `lastBuild`; undefined while it loads or when there is no last build. */
  build: FactoryEnvironmentBuild | undefined;
  activeTemplateId: string | null;
  requesting: boolean;
  onBuildNow: () => void;
}) {
  const active = build?.status === 'pending' || build?.status === 'building';
  const status = build
    ? BUILD_STATUS[build.status]
    : lastBuild
      ? undefined
      : { label: 'Never built', variant: 'neutral' as const };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <Txt as="h3" variant="label">
          Build
        </Txt>
        <Button size="sm" variant="primary" disabled={requesting || active} onClick={onBuildNow}>
          {active ? 'Building...' : 'Build now'}
        </Button>
      </div>
      <SettingsContainer>
        <SettingsRow label="Last build">
          <div className="flex items-center gap-2">
            {status ? (
              <Badge size="sm" variant={status.variant}>
                {status.label}
              </Badge>
            ) : (
              <Txt as="span" variant="meta" tone="muted">
                Loading
              </Txt>
            )}
            {lastBuild?.attemptedAt && (
              <Txt as="span" variant="meta" tone="muted">
                {formatBuildTime(lastBuild.attemptedAt)}
              </Txt>
            )}
          </div>
        </SettingsRow>
        <SettingsRow
          label="Template"
          description="The last image built ahead of sessions. Sessions reuse it while the default branches still match the built heads."
        >
          {activeTemplateId ? (
            <Txt as="span" font="mono" variant="body-sm" className="block max-w-72 truncate" title={activeTemplateId}>
              {activeTemplateId}
            </Txt>
          ) : (
            <Txt as="span" variant="body-sm" tone="muted">
              none yet
            </Txt>
          )}
        </SettingsRow>
        {build?.error && (
          <SettingsRow label="Last error">
            <Txt as="span" font="mono" variant="meta" className="text-destructive whitespace-pre-wrap">
              {build.error}
            </Txt>
          </SettingsRow>
        )}
      </SettingsContainer>
    </div>
  );
}
