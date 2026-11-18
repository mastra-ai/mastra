import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsItem } from '@mastra/playground-ui/new/settings';
import type { ReactNode } from 'react';

import { useServerVersions } from '../../../../hooks/useServerVersions';
import type { ServerVersions } from '../../../../hooks/useServerVersions';
import { DebugSectionSkeleton } from './DebugSectionSkeleton';
import { SettingsSubsection } from './SettingsSubsection';
import { RetryRow } from './common/ConnectionStateRows';

/** Plain-text version list, for pasting into an issue or a session. */
export function formatVersions({ packages, nodeVersion }: ServerVersions): string {
  return [...packages.map(({ name, version }) => `${name}@${version}`), `node@${nodeVersion}`].join('\n');
}

function VersionValue({ children }: { children: string }) {
  return (
    <Txt tone="muted" as="span" variant="caption" font="mono" className="truncate tabular-nums">
      {children}
    </Txt>
  );
}

function VersionsList({ packages, nodeVersion }: { packages: ReactNode; nodeVersion: ReactNode }) {
  return (
    <SettingsContainer>
      {packages}
      <SettingsItem title="Node.js">{nodeVersion}</SettingsItem>
    </SettingsContainer>
  );
}

export function DebugSection() {
  const query = useServerVersions();

  return (
    <SettingsSubsection
      scope="deployment"
      title="Running versions"
      description="The Mastra packages this Factory server was built with. Include them when you report an issue."
      action={
        query.isPending ? (
          <Skeleton aria-hidden className="size-control-sm rounded-full motion-reduce:before:animate-none" />
        ) : (
          query.data && (
            <CopyButton
              content={formatVersions(query.data)}
              tooltip="Copy versions"
              variant="ghost"
              size="icon-sm"
              showToast={false}
            />
          )
        )
      }
    >
      {query.isPending ? (
        <div role="status" aria-label="Loading versions">
          <VersionsList
            packages={<DebugSectionSkeleton />}
            nodeVersion={
              <span aria-hidden>
                <SkeletonText line="text-caption" className="w-12 motion-reduce:before:animate-none" />
              </span>
            }
          />
        </div>
      ) : query.isError ? (
        <SettingsContainer>
          <RetryRow label="Versions" errorMsg="Couldn't load versions." onRetry={() => void query.refetch()} />
        </SettingsContainer>
      ) : (
        <>
          {query.data.packages.length === 0 && (
            <Txt as="p" variant="caption" tone="muted" className="mb-3">
              This server's build has no package list. Builds from a newer <InlineCode>mastra</InlineCode> CLI include
              one.
            </Txt>
          )}
          <VersionsList
            packages={query.data.packages.map(({ name, version }) => (
              <SettingsItem key={name} title={name}>
                <VersionValue>{version}</VersionValue>
              </SettingsItem>
            ))}
            nodeVersion={<VersionValue>{query.data.nodeVersion}</VersionValue>}
          />
        </>
      )}
    </SettingsSubsection>
  );
}
