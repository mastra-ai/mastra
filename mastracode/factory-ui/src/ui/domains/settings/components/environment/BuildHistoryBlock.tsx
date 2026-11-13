import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@mastra/playground-ui/components/Badge';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import {
  SettingsContainer,
  SettingsEmptyRow,
  SettingsNoticeRow,
  SettingsSkeleton,
} from '@mastra/playground-ui/new/settings';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';

import type { FactoryEnvironmentBuild } from '../../../workspaces/services/environment';
import { BUILD_STATUS, formatBuildTime } from './BuildStatusBlock';

/** The provider's build history, newest first; a row opens to its error and logs. */
export function BuildHistoryBlock({
  builds,
  error,
}: {
  builds: FactoryEnvironmentBuild[] | undefined;
  error: string | undefined;
}) {
  // Only the loaded builds make a list; the error, skeleton and empty row are single rows of the same card.
  const listed = !error && builds !== undefined && builds.length > 0;
  return (
    <SettingsContainer role={listed ? 'list' : undefined} aria-label={listed ? 'Build history' : undefined}>
      <BuildHistoryRows builds={builds} error={error} />
    </SettingsContainer>
  );
}

function BuildHistoryRows({
  builds,
  error,
}: {
  builds: FactoryEnvironmentBuild[] | undefined;
  error: string | undefined;
}) {
  const [open, setOpen] = useState<string>();

  if (error) {
    return (
      <SettingsNoticeRow>
        <Notice variant="destructive">{error}</Notice>
      </SettingsNoticeRow>
    );
  }
  if (!builds) return <SettingsSkeleton label="Loading build history" rows={3} />;
  if (builds.length === 0) return <SettingsEmptyRow>No builds yet.</SettingsEmptyRow>;

  return (
    <>
      {builds.map(build => {
        const status = BUILD_STATUS[build.status];
        const expanded = open === build.buildId;
        const detail = build.error || (build.logs && build.logs.length > 0);
        return (
          <div key={build.buildId} role="listitem" className="flex flex-col gap-3">
            <button
              type="button"
              className={cn('flex w-full items-center gap-3 rounded-sm text-left', focusRing)}
              aria-expanded={expanded}
              aria-label={`Build ${build.buildId}`}
              onClick={() => setOpen(expanded ? undefined : build.buildId)}
            >
              {expanded ? (
                <ChevronDown className="size-3.5 shrink-0" aria-hidden />
              ) : (
                <ChevronRight className="size-3.5 shrink-0" aria-hidden />
              )}
              <Badge size="sm" variant={status.variant}>
                {status.label}
              </Badge>
              <Txt as="span" variant="meta" tone="muted">
                {build.finishedAt
                  ? formatBuildTime(build.finishedAt)
                  : build.startedAt
                    ? formatBuildTime(build.startedAt)
                    : ''}
              </Txt>
              <Txt
                as="span"
                font="mono"
                variant="meta"
                tone="muted"
                className="ml-auto max-w-48 truncate"
                title={build.templateId ?? build.buildId}
              >
                {build.templateId ?? build.buildId}
              </Txt>
            </button>
            {expanded && (
              <div className="flex flex-col gap-2">
                {build.error && (
                  <Txt as="p" font="mono" variant="meta" className="text-destructive whitespace-pre-wrap">
                    {build.error}
                  </Txt>
                )}
                {build.logs && build.logs.length > 0 && (
                  <pre className="bg-surface2 max-h-64 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap">
                    {build.logs.join('\n')}
                  </pre>
                )}
                {!detail && (
                  <Txt as="p" variant="meta" tone="muted">
                    No logs for this build.
                  </Txt>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
