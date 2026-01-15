import { useState } from 'react';
import { Copy, Check, MoveRight, Info, ExternalLink } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Spinner } from '@/ds/components/Spinner';
import { Txt } from '@/ds/components/Txt/Txt';
import { useMastraPackages } from '../hooks/use-mastra-packages';
import { usePackageUpdates, type PackageUpdateInfo } from '../hooks/use-package-updates';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/ds/components/Dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { SelectField } from '@/ds/components/FormFields';

export interface MastraVersionFooterProps {
  collapsed?: boolean;
}

type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun';

const packageManagerCommands: Record<PackageManager, string> = {
  pnpm: 'pnpm add',
  npm: 'npm install',
  yarn: 'yarn add',
  bun: 'bun add',
};

export const MastraVersionFooter = ({ collapsed }: MastraVersionFooterProps) => {
  const { data, isLoading: isLoadingPackages } = useMastraPackages();
  const installedPackages = data?.packages ?? [];

  const {
    packages: packageUpdates,
    isLoading: isLoadingUpdates,
    outdatedCount,
    deprecatedCount,
  } = usePackageUpdates(installedPackages);

  const hasUpdates = outdatedCount > 0 || deprecatedCount > 0;

  const [packageManager, setPackageManager] = useState<PackageManager>('pnpm');

  // Don't render anything when the sidebar is collapsed
  if (collapsed) {
    return null;
  }

  if (isLoadingPackages) {
    return (
      <div className="px-3 py-2">
        <div className="animate-pulse h-4 bg-surface2 rounded w-16"></div>
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
      <DialogTrigger asChild>
        <button className="px-3 py-2 hover:bg-surface2 transition-colors rounded w-full text-left">
          <div className="flex items-center gap-1.5">
            <Txt as="span" variant="ui-sm" className="text-accent1 font-mono">
              mastra version:
            </Txt>
          </div>
          <div className="flex items-center gap-2">
            <Txt as="span" variant="ui-sm" className="text-neutral3 font-mono">
              {mainVersion}
            </Txt>
            {isLoadingUpdates && <Spinner className="w-3 h-3" color="currentColor" />}
            <span className="flex items-center -space-x-1.5">
              {outdatedCount > 0 && <CountBadge count={outdatedCount} variant="warning" />}
              {deprecatedCount > 0 && <CountBadge count={deprecatedCount} variant="error" />}
            </span>
          </div>
        </button>
      </DialogTrigger>
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
        'inline-flex font-bold rounded-md px-1.5 py-0.5 items-center justify-center text-black text-xs min-w-[1.25rem]',
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
  const { isCopied: isCopiedAll, handleCopy: handleCopyAll } = useCopyToClipboard({
    text: packagesText,
    copyMessage: 'Copied package versions!',
  });
  const { isCopied: isCopiedCommand, handleCopy: handleCopyCommand } = useCopyToClipboard({
    text: updateCommand ?? '',
    copyMessage: 'Copied update command!',
  });

  return (
    <DialogContent className="bg-surface1 border-border1 max-w-2xl">
      <DialogHeader>
        <DialogTitle className="text-text1">Installed Mastra Packages</DialogTitle>
      </DialogHeader>

      {/* Status summary */}
      <div className="text-sm text-neutral3 py-2">
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

      {/* Copy current versions button - always visible */}
      <button
        onClick={handleCopyAll}
        className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded bg-surface2 hover:bg-surface3 text-neutral3 hover:text-neutral1 transition-colors"
      >
        {isCopiedAll ? <Check className="w-4 h-4 text-accent1" /> : <Copy className="w-4 h-4" />}
        <Txt as="span" variant="ui-sm">
          {isCopiedAll ? 'Copied!' : 'Copy current versions'}
        </Txt>
      </button>

      {/* Update command section */}
      {hasUpdates && updateCommand && (
        <div className="space-y-3 pt-2 border-t border-border1">
          <div className="flex items-center gap-2 text-sm text-neutral3 pt-3">
            <Info className="w-4 h-4" />
            <span>Use the command below to update your packages</span>
          </div>

          <div className="flex gap-2 items-center">
            <SelectField
              value={packageManager}
              onValueChange={value => onPackageManagerChange(value as PackageManager)}
              options={[
                { label: 'pnpm', value: 'pnpm' },
                { label: 'npm', value: 'npm' },
                { label: 'yarn', value: 'yarn' },
                { label: 'bun', value: 'bun' },
              ]}
            />

            <pre className="flex-1 text-sm text-neutral3 bg-surface2 rounded-md px-3 py-1.5 overflow-x-auto whitespace-pre-wrap break-all">
              {updateCommand}
            </pre>
          </div>

          <button
            onClick={handleCopyCommand}
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded bg-surface2 hover:bg-surface3 text-neutral3 hover:text-neutral1 transition-colors"
          >
            {isCopiedCommand ? <Check className="w-4 h-4 text-accent1" /> : <Copy className="w-4 h-4" />}
            <Txt as="span" variant="ui-sm">
              {isCopiedCommand ? 'Copied!' : 'Copy command'}
            </Txt>
          </button>
        </div>
      )}
    </DialogContent>
  );
};

// Keep the old export for backwards compatibility
export const MastraPackagesInfo = MastraVersionFooter;
