import { CodeBlock } from '@mastra/playground-ui/components/CodeBlock';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogBody,
} from '@mastra/playground-ui/components/Dialog';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { MoveRight, ExternalLink, Info } from 'lucide-react';
import { useState } from 'react';
import { useMastraPackages } from '../hooks/use-mastra-packages';
import { usePackageUpdates } from '../hooks/use-package-updates';
import type { PackageUpdateInfo } from '../hooks/use-package-updates';

export interface MastraVersionFooterProps {
  collapsed?: boolean;
}

const PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn', 'bun'] as const;
type PackageManager = (typeof PACKAGE_MANAGERS)[number];

const isPackageManager = (value: string): value is PackageManager =>
  (PACKAGE_MANAGERS as readonly string[]).includes(value);

const packageManagerCommands: Record<PackageManager, string> = {
  pnpm: 'pnpm add',
  npm: 'npm install',
  yarn: 'yarn add',
  bun: 'bun add',
};

const versionBadgeClassName =
  'inline-flex h-[1.375rem] items-center rounded-full bg-sidebar-nav-active px-2.5 font-sans text-ui-xs font-semibold leading-none tracking-normal text-black/80 tabular-nums whitespace-nowrap dark:text-neutral6';

export const MastraVersionFooter = ({ collapsed }: MastraVersionFooterProps) => {
  const { data, isLoading: isLoadingPackages } = useMastraPackages();
  const installedPackages = data?.packages ?? [];

  const {
    packages: packageUpdates,
    isLoading: isLoadingUpdates,
    outdatedCount,
    deprecatedCount,
  } = usePackageUpdates(installedPackages);

  const [packageManager, setPackageManager] = useState<PackageManager>('pnpm');

  // Don't render anything when the sidebar is collapsed
  if (collapsed) {
    return null;
  }

  // Only show version footer in dev mode
  if (!data?.isDev) {
    return null;
  }

  if (isLoadingPackages) {
    return (
      <div className="flex items-center justify-end gap-2 px-3 h-9">
        <div className="animate-pulse h-[1.125rem] w-20 bg-surface4 rounded-full" />
      </div>
    );
  }

  const mastraCorePackage = installedPackages.find((pkg: { name: string }) => pkg.name === '@mastra/core');

  if (!mastraCorePackage && installedPackages.length === 0) {
    return null;
  }

  const mainVersion = mastraCorePackage?.version ?? installedPackages[0]?.version ?? '';

  const updateCommand = generateUpdateCommand(packageUpdates, packageManager);

  return (
    <Dialog>
      <div className="flex px-3 py-1.5">
        <DialogTrigger asChild>
          <button
            type="button"
            className="flex rounded-lg p-1 hover:bg-sidebar-nav-hover transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-accent1 focus-visible:shadow-focus-ring"
          >
            <span className="relative inline-flex">
              {(isLoadingUpdates || outdatedCount > 0 || deprecatedCount > 0) && (
                <span className="absolute -right-1.5 -top-1.5 flex items-center gap-1">
                  {isLoadingUpdates && <Spinner className="size-3 text-neutral3" />}
                  {outdatedCount > 0 && <CountBadge count={outdatedCount} variant="warning" />}
                  {deprecatedCount > 0 && <CountBadge count={deprecatedCount} variant="error" />}
                </span>
              )}
              <span className={versionBadgeClassName}>v{mainVersion}</span>
            </span>
          </button>
        </DialogTrigger>
      </div>
      <PackagesModalContent
        packages={packageUpdates}
        isLoadingUpdates={isLoadingUpdates}
        outdatedCount={outdatedCount}
        deprecatedCount={deprecatedCount}
        updateCommand={updateCommand}
        packageManager={packageManager}
        onPackageManagerChange={setPackageManager}
      />
    </Dialog>
  );
};

function generateUpdateCommand(packages: PackageUpdateInfo[], packageManager: PackageManager): string | null {
  const outdatedPackages = packages.filter(p => p.isOutdated || p.isDeprecated);
  if (outdatedPackages.length === 0) return null;

  const command = packageManagerCommands[packageManager];
  // Use the target's prerelease tag to ensure the command installs the version shown in the UI
  const packageArgs = outdatedPackages.map(p => `${p.name}@${p.targetPrereleaseTag ?? 'latest'}`).join(' ');

  return `${command} ${packageArgs}`;
}

function CountBadge({ count, variant }: { count: number; variant: 'warning' | 'error' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded-full text-ui-xs font-bold text-black',
        variant === 'error' ? 'bg-red-700' : 'bg-yellow-700',
      )}
    >
      {count}
    </span>
  );
}

function StatusBadge({ value, variant }: { value: string | number; variant: 'warning' | 'error' }) {
  return (
    <span
      className={cn(
        'inline-flex font-bold rounded-md px-1.5 py-0.5 items-center justify-center text-black text-xs min-w-5',
        variant === 'error' ? 'bg-red-700' : 'bg-yellow-700',
      )}
    >
      {value}
    </span>
  );
}

export interface PackagesModalContentProps {
  packages: PackageUpdateInfo[];
  isLoadingUpdates: boolean;
  outdatedCount: number;
  deprecatedCount: number;
  updateCommand: string | null;
  packageManager: PackageManager;
  onPackageManagerChange: (pm: PackageManager) => void;
}

const PackagesModalContent = ({
  packages,
  isLoadingUpdates,
  outdatedCount,
  deprecatedCount,
  updateCommand,
  packageManager,
  onPackageManagerChange,
}: PackagesModalContentProps) => {
  const hasUpdates = outdatedCount > 0 || deprecatedCount > 0;

  const packagesText = packages.map(pkg => `${pkg.name}@${pkg.version}`).join('\n');

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Installed Mastra Packages</DialogTitle>
        <DialogDescription>View and update installed Mastra packages</DialogDescription>
      </DialogHeader>

      <DialogBody>
        {/* Status summary */}
        <div className="flex items-center justify-between gap-3 text-sm text-neutral3 py-2">
          {isLoadingUpdates ? (
            <span className="text-neutral3">Checking for updates...</span>
          ) : !hasUpdates ? (
            <span className="text-accent1">✓ All packages are up to date</span>
          ) : (
            <div className="flex items-center gap-3">
              {outdatedCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <StatusBadge value={outdatedCount} variant="warning" />
                  <span>package{outdatedCount !== 1 ? 's' : ''} outdated</span>
                </span>
              )}
              {deprecatedCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <StatusBadge value={deprecatedCount} variant="error" />
                  <span>package{deprecatedCount !== 1 ? 's' : ''} deprecated</span>
                </span>
              )}
            </div>
          )}
          <CopyButton
            content={packagesText}
            copyMessage="Copied package versions!"
            tooltip="Copy current versions"
            size="sm"
          />
        </div>

        {/* Package list */}
        <div className="max-h-64 overflow-y-auto border border-border1 rounded-md">
          <div className="grid grid-cols-[1fr_auto_auto] text-sm">
            {packages.map((pkg, index) => (
              <div key={pkg.name} className={cn('contents', index > 0 && '[&>div]:border-t [&>div]:border-border1')}>
                <div className="py-2 px-3 font-mono text-text1 truncate min-w-0">
                  <a
                    href={`https://www.npmjs.com/package/${pkg.name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-accent1 hover:underline inline-flex items-center gap-1 group"
                  >
                    {pkg.name}
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </div>
                <div className="py-2 px-3 font-mono text-neutral3 flex items-center gap-1.5">
                  {pkg.isOutdated || pkg.isDeprecated ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={cn(
                            'cursor-help',
                            pkg.isDeprecated ? 'text-red-500' : pkg.isOutdated ? 'text-yellow-500' : '',
                          )}
                        >
                          {pkg.version}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {pkg.isDeprecated
                          ? pkg.deprecationMessage || 'This version is deprecated'
                          : 'Newer version available'}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span>{pkg.version}</span>
                  )}
                </div>
                <div className="py-2 px-3 font-mono text-neutral3 flex items-center">
                  {(pkg.isOutdated || pkg.isDeprecated) && pkg.latestVersion && (
                    <>
                      <MoveRight className="w-4 h-4 mx-2 text-neutral3" />
                      <span className="text-accent1">{pkg.latestVersion}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Update command section */}
        {hasUpdates && updateCommand && (
          <div className="space-y-2 pt-2 border-t border-border1">
            <div className="flex items-center gap-2 pt-3">
              <Info className="w-4 h-4 text-neutral3" />
              <Txt as="span" variant="ui-sm" className="text-neutral3">
                Use the command below to update your packages
              </Txt>
            </div>
            <CodeBlock
              code={updateCommand}
              options={[
                { label: 'pnpm', value: 'pnpm' },
                { label: 'npm', value: 'npm' },
                { label: 'yarn', value: 'yarn' },
                { label: 'bun', value: 'bun' },
              ]}
              value={packageManager}
              onValueChange={value => {
                if (isPackageManager(value)) onPackageManagerChange(value);
              }}
              copyMessage="Copied update command!"
              copyTooltip="Copy command"
            />
          </div>
        )}
      </DialogBody>
    </DialogContent>
  );
};

// Keep the old export for backwards compatibility
export const MastraPackagesInfo = MastraVersionFooter;
