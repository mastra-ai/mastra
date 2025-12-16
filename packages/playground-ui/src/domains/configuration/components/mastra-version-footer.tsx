'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { Txt } from '@/ds/components/Txt/Txt';
import { useMastraPackages } from '../hooks/use-mastra-packages';
import { cn } from '@/lib/utils';

export interface MastraVersionFooterProps {
  collapsed?: boolean;
}

export const MastraVersionFooter = ({ collapsed }: MastraVersionFooterProps) => {
  const { data, isLoading } = useMastraPackages();
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="px-3 py-2">
        <div className="animate-pulse h-4 bg-surface2 rounded w-16"></div>
      </div>
    );
  }

  const packages = data?.packages ?? [];
  const mastraCliPackage = packages.find(pkg => pkg.name === 'mastra');

  if (!mastraCliPackage && packages.length === 0) {
    return null;
  }

  const mainVersion = mastraCliPackage?.version ?? packages[0]?.version ?? '';

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const packagesText = packages.map(pkg => `${pkg.name}@${pkg.version}`).join('\n');
    await navigator.clipboard.writeText(packagesText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  if (collapsed) {
    return (
      <div className="px-3 py-2">
        <Txt as="span" variant="ui-sm" className="text-accent1 font-mono">
          v.{mainVersion}
        </Txt>
      </div>
    );
  }

  return (
    <div className="px-3 py-2">
      <button
        onClick={toggleExpanded}
        className="flex flex-col items-start w-full text-left group"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-1.5">
          <Txt as="span" variant="ui-sm" className="text-accent1 font-mono">
            mastra version:
          </Txt>
          {packages.length > 1 && (
            <span className="text-icon3 opacity-0 group-hover:opacity-100 transition-opacity">
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </span>
          )}
        </div>
        <Txt as="span" variant="ui-sm" className="text-icon3 font-mono">
          {mainVersion}
        </Txt>
      </button>

      {isExpanded && packages.length > 0 && (
        <div className="mt-2 space-y-1 pl-0">
          <div className="flex items-center justify-between mb-2">
            <Txt as="span" variant="ui-sm" className="text-icon3">
              Installed packages
            </Txt>
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-surface2 text-icon3 hover:text-icon1 transition-colors"
              title="Copy all packages"
            >
              {copied ? <Check className="w-3 h-3 text-accent1" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {packages.map(pkg => (
              <div key={pkg.name} className={cn('flex items-center justify-between py-0.5')}>
                <Txt as="span" variant="ui-sm" className="text-icon3 font-mono truncate">
                  {pkg.name}
                </Txt>
                <Txt as="span" variant="ui-sm" className="text-icon3 font-mono ml-2 shrink-0">
                  {pkg.version}
                </Txt>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Keep the old export for backwards compatibility
export const MastraPackagesInfo = MastraVersionFooter;
