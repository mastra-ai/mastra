import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';

import type { FactoryEnvironmentBuild } from '../../../workspaces/services/environment';

const STATUS: Record<
  NonNullable<FactoryEnvironmentBuild['status']>,
  { label: string; variant: 'neutral' | 'success' | 'destructive' | 'warning' | 'info' }
> = {
  ready: { label: 'Ready', variant: 'success' },
  partial: { label: 'Partially configured', variant: 'warning' },
  failed: { label: 'Failed', variant: 'destructive' },
  building: { label: 'Building', variant: 'info' },
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

/** The last build: status, when it finished, which template it produced, what went wrong, and Build now. */
export function BuildStatusBlock({
  build,
  requesting,
  onBuildNow,
}: {
  build: FactoryEnvironmentBuild;
  requesting: boolean;
  onBuildNow: () => void;
}) {
  const status = build.status ? STATUS[build.status] : { label: 'Never built', variant: 'neutral' as const };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <Txt as="h3" variant="label">
          Status
        </Txt>
        <Button size="sm" variant="primary" disabled={requesting || build.status === 'building'} onClick={onBuildNow}>
          {build.status === 'building' ? 'Building…' : 'Build now'}
        </Button>
      </div>
      <SettingsContainer>
        <SettingsRow label="Last build">
          <div className="flex items-center gap-2">
            <Badge size="sm" variant={status.variant}>
              {status.label}
            </Badge>
            {build.requestedAt && (
              <Badge size="sm" variant="info" emphasis="subtle">
                Build requested
              </Badge>
            )}
            {build.lastBuiltAt && (
              <Txt as="span" variant="meta" tone="muted">
                {formatTime(build.lastBuiltAt)}
              </Txt>
            )}
          </div>
        </SettingsRow>
        <SettingsRow label="Template" description="Sessions boot from this image until the next successful build.">
          {build.activeTemplateId ? (
            <Txt
              as="span"
              font="mono"
              variant="body-sm"
              className="block max-w-72 truncate"
              title={build.activeTemplateId}
            >
              {build.activeTemplateId}
            </Txt>
          ) : (
            <Txt as="span" variant="body-sm" tone="muted">
              none yet
            </Txt>
          )}
        </SettingsRow>
        {build.error && (
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
