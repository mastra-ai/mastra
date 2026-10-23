import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@mastra/playground-ui/components/Badge';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';

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
  const [open, setOpen] = useState<string>();

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <Notice variant="destructive">{error}</Notice>
      ) : !builds ? (
        <Skeleton className="h-12 w-full" />
      ) : builds.length === 0 ? (
        <Txt as="p" variant="meta" tone="muted">
          No builds yet.
        </Txt>
      ) : (
        <SettingsContainer>
          <ul className="divide-border flex flex-col divide-y">
            {builds.map(build => {
              const status = BUILD_STATUS[build.status];
              const expanded = open === build.buildId;
              const detail = build.error || (build.logs && build.logs.length > 0);
              return (
                <li key={build.buildId} className="flex flex-col">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
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
                    <div className="flex flex-col gap-2 px-4 pb-3">
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
                </li>
              );
            })}
          </ul>
        </SettingsContainer>
      )}
    </div>
  );
}
