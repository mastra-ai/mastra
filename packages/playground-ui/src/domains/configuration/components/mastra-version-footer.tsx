'use client';

import { useState } from 'react';
import { Copy, Check, Package, MoveRight, Info, ExternalLink } from 'lucide-react';
import Spinner from '@/components/ui/spinner';
import { Txt } from '@/ds/components/Txt/Txt';
import { useMastraPackages } from '../hooks/use-mastra-packages';
import { usePackageUpdates, type PackageUpdateInfo } from '../hooks/use-package-updates';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SelectField } from '@/components/ui/elements/form-fields/select-field';

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

  const [copied, setCopied] = useState(false);
  const [packageManager, setPackageManager] = useState<PackageManager>('pnpm');

  if (isLoadingPackages) {
    return (
      <div className={cn('px-3 py-2', collapsed && 'flex justify-center')}>
        <div className={cn('animate-pulse h-4 bg-surface2 rounded', collapsed ? 'w-4' : 'w-16')}></div>
      </div>
    );
  }

  const mastraCorePackage = installedPackages.find(pkg => pkg.name === '@mastra/core');

  if (!mastraCorePackage && installedPackages.length === 0) {
    return null;
  }

  const mainVersion = mastraCorePackage?.version ?? installedPackages[0]?.version ?? '';

  const updateCommand = generateUpdateCommand(packageUpdates, packageManager);

  const handleCopyCommand = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!updateCommand) return;
    await navigator.clipboard.writeText(updateCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const packagesText = installedPackages.map(pkg => `${pkg.name}@${pkg.version}`).join('\n');
    await navigator.clipboard.writeText(packagesText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (collapsed) {
    return (
      <Dialog>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <button className="flex items-center justify-center min-h-[2rem] py-[6px] px-[0.75rem] w-full rounded-lg text-icon3/60 hover:bg-surface4 hover:text-icon3 transition-colors relative">
                <Package className="w-4 h-4" />
                {isLoadingUpdates && <LoadingSpinner />}
                {hasUpdates && <StatusDot variant={deprecatedCount > 0 ? 'error' : 'warning'} />}
              </button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" align="center" className="bg-border1 text-icon6 ml-[1rem]">
            <span>Mastra Packages</span>
            <span className="block text-xs mt-0.5">
              {outdatedCount > 0 && <span className="text-yellow-500">{outdatedCount} outdated</span>}
              {outdatedCount > 0 && deprecatedCount > 0 && ', '}
              {deprecatedCount > 0 && <span className="text-red-400">{deprecatedCount} deprecated</span>}
            </span>
          </TooltipContent>
        </Tooltip>
        <PackagesModalContent
          packages={packageUpdates}
          isLoadingUpdates={isLoadingUpdates}
          outdatedCount={outdatedCount}
          deprecatedCount={deprecatedCount}
          updateCommand={updateCommand}
          packageManager={packageManager}
          onPackageManagerChange={setPackageManager}
          copied={copied}
          onCopyCommand={handleCopyCommand}
          onCopyAll={handleCopyAll}
        />
      </Dialog>
    );
  }

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
            <Txt as="span" variant="ui-sm" className="text-icon3 font-mono">
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
        copied={copied}
        onCopyCommand={handleCopyCommand}
        onCopyAll={handleCopyAll}
      />
    </Dialog>
  );
};

function generateUpdateCommand(packages: PackageUpdateInfo[], packageManager: PackageManager): string | null {
  const outdatedPackages = packages.filter(p => p.isOutdated || p.isDeprecated);
  if (outdatedPackages.length === 0) return null;

  const command = packageManagerCommands[packageManager];
  // Use the prerelease tag (e.g., @beta, @alpha) to avoid downgrading prerelease users
  const packageArgs = outdatedPackages.map(p => `${p.name}@${p.prereleaseTag ?? 'latest'}`).join(' ');

  return `${command} ${packageArgs}`;
}

function LoadingSpinner() {
  return (
    <span className="absolute top-0 right-0">
      <Spinner className="w-3 h-3" color="currentColor" />
    </span>
  );
}

function StatusDot({ variant }: { variant: 'warning' | 'error' }) {
  return (
    <span
      className={cn(
        'absolute top-0 right-0 w-2 h-2 rounded-full',
        variant === 'error' ? 'bg-red-500' : 'bg-yellow-500',
      )}
    />
  );
}

function CountBadge({ count, variant }: { count: number; variant: 'warning' | 'error' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded-full text-[0.625rem] font-bold text-black',
        variant === 'error' ? 'bg-red-500' : 'bg-yellow-500',
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
        variant === 'error' ? 'bg-red-500' : 'bg-yellow-500',
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
  copied: boolean;
  onCopyCommand: (e: React.MouseEvent) => void;
  onCopyAll: (e: React.MouseEvent) => void;
}

const PackagesModalContent = ({
  packages,
  isLoadingUpdates,
  outdatedCount,
  deprecatedCount,
  updateCommand,
  packageManager,
  onPackageManagerChange,
  copied,
  onCopyCommand,
  onCopyAll,
}: PackagesModalContentProps) => {
  const hasUpdates = outdatedCount > 0 || deprecatedCount > 0;

  return (
    <DialogContent className="bg-surface1 border-border1 max-w-2xl">
      <DialogHeader>
        <DialogTitle className="text-text1">Installed Mastra Packages</DialogTitle>
      </DialogHeader>

      {/* Status summary */}
      <div className="text-sm text-icon3 py-2">
        {isLoadingUpdates ? (
          <span className="text-icon3">Checking for updates...</span>
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
              <div className="py-2 px-3 font-mono text-text1 truncate">
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
              <div className="py-2 px-3 font-mono text-icon3 flex items-center gap-1.5">
                {pkg.isOutdated || pkg.isDeprecated ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={cn(
                          'cursor-help',
                          pkg.isDeprecated ? 'text-red-400' : pkg.isOutdated ? 'text-yellow-400' : '',
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
              <div className="py-2 px-3 font-mono text-icon3 flex items-center">
                {(pkg.isOutdated || pkg.isDeprecated) && pkg.latestVersion && (
                  <>
                    <MoveRight className="w-4 h-4 mx-2 text-icon3" />
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
        onClick={onCopyAll}
        className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded bg-surface2 hover:bg-surface3 text-icon3 hover:text-icon1 transition-colors"
      >
        {copied ? <Check className="w-4 h-4 text-accent1" /> : <Copy className="w-4 h-4" />}
        <Txt as="span" variant="ui-sm">
          {copied ? 'Copied!' : 'Copy current versions'}
        </Txt>
      </button>

      {/* Update command section */}
      {hasUpdates && updateCommand && (
        <div className="space-y-3 pt-2 border-t border-border1">
          <div className="flex items-center gap-2 text-sm text-icon3 pt-3">
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

            <pre className="flex-1 text-sm text-icon3 bg-surface2 rounded-md px-3 py-1.5 overflow-x-auto whitespace-pre-wrap break-all">
              {updateCommand}
            </pre>
          </div>

          <button
            onClick={onCopyCommand}
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded bg-surface2 hover:bg-surface3 text-icon3 hover:text-icon1 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-accent1" /> : <Copy className="w-4 h-4" />}
            <Txt as="span" variant="ui-sm">
              {copied ? 'Copied!' : 'Copy command'}
            </Txt>
          </button>
        </div>
      )}
    </DialogContent>
  );
};

// Keep the old export for backwards compatibility
export const MastraPackagesInfo = MastraVersionFooter;
