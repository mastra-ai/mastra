import { Button } from '@mastra/playground-ui/components/Button';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useMastraPackages } from '@mastra/react/hooks/configuration';
import { ArrowRight, CircleCheck, ExternalLink, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { usePackageUpdates } from '../hooks/use-package-updates';
import type { PackageUpdateInfo } from '../hooks/use-package-updates';

const PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn', 'bun'] as const;
type PackageManager = (typeof PACKAGE_MANAGERS)[number];

const installCommands: Record<PackageManager, string> = {
  pnpm: 'pnpm add',
  npm: 'npm install',
  yarn: 'yarn add',
  bun: 'bun add',
};

const RELEASES_URL = 'https://github.com/mastra-ai/mastra/releases';

export interface MastraPackagesPanelProps {
  version: string;
}

/** What's installed, what can be updated, and the command to update it. */
export const MastraPackagesPanel = ({ version }: MastraPackagesPanelProps) => {
  const { data } = useMastraPackages();
  const installedPackages = data?.packages ?? [];
  const {
    packages,
    isLoading: isLoadingUpdates,
    outdatedCount,
    deprecatedCount,
  } = usePackageUpdates(installedPackages);
  // Deprecated first, then outdated, so the packages that need attention are on top.
  const sorted = [...packages].sort(
    (a, b) => Number(b.isDeprecated) - Number(a.isDeprecated) || Number(b.isOutdated) - Number(a.isOutdated),
  );

  return (
    <div className="w-[22rem] space-y-2 p-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Txt variant="label" tone="ink" className="tabular-nums">
            Mastra {version}
          </Txt>
          <UpdateStatus
            isLoadingUpdates={isLoadingUpdates}
            outdatedCount={outdatedCount}
            deprecatedCount={deprecatedCount}
          />
        </div>
        <div className="flex items-center gap-0.5">
          <CopyButton
            content={installedPackages.map(pkg => `${pkg.name}@${pkg.version}`).join('\n')}
            tooltip="Copy versions"
            variant="ghost"
            size="icon-sm"
            showToast={false}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            tooltip="Changelog"
            aria-label="Changelog"
            render={<a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" />}
          >
            <ExternalLink />
          </Button>
        </div>
      </div>

      {/* Pulled out to the popover's edges so the scrollbar sits on its border; the list keeps its inset. */}
      <ScrollArea maxHeight="16rem" mask={{ y: '1.5rem' }} className="-mx-4 [--scroll-area-scrollbar-inset:0px]">
        <ul className="px-2">
          {sorted.map(pkg => (
            <PackageRow key={pkg.name} pkg={pkg} />
          ))}
        </ul>
      </ScrollArea>

      {/* Only packages with a newer version: a deprecated package already on latest has nothing to install. */}
      <UpdateCommand packages={packages.filter(pkg => pkg.isOutdated)} />
    </div>
  );
};

function UpdateStatus({
  isLoadingUpdates,
  outdatedCount,
  deprecatedCount,
}: {
  isLoadingUpdates: boolean;
  outdatedCount: number;
  deprecatedCount: number;
}) {
  if (isLoadingUpdates) {
    return (
      <p className="mt-0.5 flex items-center gap-1.5 text-meta text-muted-foreground">
        <Spinner className="size-3" />
        Checking for updates…
      </p>
    );
  }

  if (outdatedCount === 0 && deprecatedCount === 0) {
    return (
      <p className="mt-0.5 flex items-center gap-1.5 text-meta text-success-indicator">
        <CircleCheck className="size-3.5" />
        Up to date
      </p>
    );
  }

  const parts = [
    deprecatedCount > 0 && `${deprecatedCount} deprecated`,
    outdatedCount > 0 && `${outdatedCount} update${outdatedCount === 1 ? '' : 's'} available`,
  ].filter(Boolean);

  return (
    <p
      className={cn(
        'mt-0.5 flex items-center gap-1.5 text-meta',
        deprecatedCount > 0 ? 'text-destructive-foreground' : 'text-warning-foreground',
      )}
    >
      <TriangleAlert className="size-3.5" />
      {parts.join(', ')}
    </p>
  );
}

function PackageRow({ pkg }: { pkg: PackageUpdateInfo }) {
  const needsUpdate = pkg.isOutdated || pkg.isDeprecated;

  return (
    <li
      title={pkg.deprecationMessage}
      className="flex items-center gap-2 rounded-md px-2 py-1 text-caption hover:bg-fill-subtle"
    >
      <a
        href={`https://www.npmjs.com/package/${pkg.name}`}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1 truncate font-mono text-muted-foreground hover:text-foreground"
      >
        {pkg.name}
      </a>
      <span className={cn('font-mono tabular-nums', versionToneClass(pkg))}>{pkg.version}</span>
      {needsUpdate && pkg.latestVersion && (
        <>
          <ArrowRight aria-label="updates to" className="size-3 text-placeholder" />
          <span className="font-mono text-foreground tabular-nums">{pkg.latestVersion}</span>
        </>
      )}
    </li>
  );
}

function versionToneClass(pkg: PackageUpdateInfo) {
  if (pkg.isDeprecated) return 'text-destructive-foreground';
  if (pkg.isOutdated) return 'text-warning-foreground';
  return 'text-placeholder';
}

function UpdateCommand({ packages }: { packages: PackageUpdateInfo[] }) {
  const [packageManager, setPackageManager] = useState<PackageManager>('pnpm');
  if (packages.length === 0) return null;

  // `latestVersion` is the registry's `latest` dist-tag, so `@latest` installs exactly what the list shows.
  const command = `${installCommands[packageManager]} ${packages.map(pkg => `${pkg.name}@latest`).join(' ')}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Txt as="span" variant="caption" tone="muted">
          Update with
        </Txt>
        <div className="flex gap-0.5">
          {PACKAGE_MANAGERS.map(name => (
            <button
              key={name}
              type="button"
              aria-pressed={packageManager === name}
              onClick={() => setPackageManager(name)}
              className={cn(
                'rounded-md px-1.5 py-0.5 text-meta text-muted-foreground hover:text-foreground',
                packageManager === name && 'bg-fill text-foreground',
              )}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1 rounded-lg border border-border bg-fill-subtle py-1 pr-1 pl-2.5">
        <Txt as="span" variant="meta" font="mono" className="min-w-0 flex-1 truncate" title={command}>
          {command}
        </Txt>
        <CopyButton content={command} tooltip="Copy command" variant="ghost" size="icon-sm" showToast={false} />
      </div>
    </div>
  );
}
