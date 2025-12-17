'use client';

import { useState } from 'react';
import { Copy, Check, Package } from 'lucide-react';
import { Txt } from '@/ds/components/Txt/Txt';
import { useMastraPackages } from '../hooks/use-mastra-packages';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface MastraVersionFooterProps {
  collapsed?: boolean;
}

export const MastraVersionFooter = ({ collapsed }: MastraVersionFooterProps) => {
  const { data, isLoading } = useMastraPackages();
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className={cn('px-3 py-2', collapsed && 'flex justify-center')}>
        <div className={cn('animate-pulse h-4 bg-surface2 rounded', collapsed ? 'w-4' : 'w-16')}></div>
      </div>
    );
  }

  const packages = data?.packages ?? [];
  const mastraCorePackage = packages.find(pkg => pkg.name === '@mastra/core');

  if (!mastraCorePackage && packages.length === 0) {
    return null;
  }

  const mainVersion = mastraCorePackage?.version ?? packages[0]?.version ?? '';

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const packagesText = packages.map(pkg => `${pkg.name}@${pkg.version}`).join('\n');
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
              <button className="flex items-center justify-center min-h-[2rem] py-[6px] px-[0.75rem] w-full rounded-lg text-icon3/60 hover:bg-surface4 hover:text-icon3 transition-colors">
                <Package className="w-4 h-4" />
              </button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" align="center" className="bg-border1 text-icon6 ml-[1rem]">
            Mastra Packages
          </TooltipContent>
        </Tooltip>
        <PackagesModalContent packages={packages} copied={copied} onCopy={handleCopy} />
      </Dialog>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="px-3 py-2 hover:bg-surface2 transition-colors rounded w-full text-left group">
          <div className="flex items-center gap-1.5">
            <Txt as="span" variant="ui-sm" className="text-accent1 font-mono">
              mastra version:
            </Txt>
            <Package className="w-3 h-3 text-icon3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <Txt as="span" variant="ui-sm" className="text-icon3 font-mono">
            {mainVersion}
          </Txt>
        </button>
      </DialogTrigger>
      <PackagesModalContent packages={packages} copied={copied} onCopy={handleCopy} />
    </Dialog>
  );
};

export interface PackageInfo {
  name: string;
  version: string;
}

export interface PackagesModalContentProps {
  packages: PackageInfo[];
  copied: boolean;
  onCopy: (e: React.MouseEvent) => void;
}

const PackagesModalContent = ({ packages, copied, onCopy }: PackagesModalContentProps) => {
  return (
    <DialogContent className="bg-surface1 border-border1">
      <DialogHeader>
        <DialogTitle className="flex items-center justify-between">
          <span className="text-text1">Installed Mastra Packages</span>
          <button
            onClick={onCopy}
            className="p-2 rounded hover:bg-surface2 text-icon3 hover:text-icon1 transition-colors"
            title="Copy all packages"
          >
            {copied ? <Check className="w-4 h-4 text-accent1" /> : <Copy className="w-4 h-4" />}
          </button>
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {packages.map(pkg => (
          <div key={pkg.name} className={cn('flex items-center justify-between py-2 px-3 rounded bg-surface2')}>
            <Txt as="span" variant="ui-sm" className="text-text1 font-mono truncate">
              {pkg.name}
            </Txt>
            <Txt as="span" variant="ui-sm" className="text-icon3 font-mono ml-2 shrink-0">
              {pkg.version}
            </Txt>
          </div>
        ))}
      </div>
    </DialogContent>
  );
};

// Keep the old export for backwards compatibility
export const MastraPackagesInfo = MastraVersionFooter;
