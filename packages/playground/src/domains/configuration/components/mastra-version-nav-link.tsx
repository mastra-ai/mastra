import { Badge } from '@mastra/playground-ui/components/Badge';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import type { SidebarState } from '@mastra/playground-ui/components/Sidebar';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useMastraPackages } from '@mastra/react/hooks/configuration';
import { Package } from 'lucide-react';
import { useState } from 'react';
import { usePackageUpdates } from '../hooks/use-package-updates';
import { MastraPackagesPanel } from './mastra-packages-panel';

export interface MastraVersionNavLinkProps {
  state?: SidebarState;
}

/**
 * The installed Mastra version as a sidebar row, next to Settings and Resources. An "Update" badge
 * shows when packages are outdated or deprecated; clicking the row opens the package details.
 * Only rendered in `mastra dev`.
 */
export const MastraVersionNavLink = ({ state }: MastraVersionNavLinkProps) => {
  const [open, setOpen] = useState(false);
  const { data } = useMastraPackages();
  const installedPackages = data?.packages ?? [];
  const { packages, isLoading, outdatedCount, deprecatedCount } = usePackageUpdates(installedPackages);

  if (!data?.isDev || installedPackages.length === 0) return null;

  const corePackage = installedPackages.find(pkg => pkg.name === '@mastra/core');
  const version = corePackage?.version ?? installedPackages[0].version;
  const isCollapsed = state === 'collapsed';
  const needsUpdate = outdatedCount > 0 || deprecatedCount > 0;
  const badgeVariant = deprecatedCount > 0 ? 'destructive' : 'warning';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Sidebar.NavLink
        state={state}
        isActive={open}
        link={{ name: `Mastra v${version}`, url: '#' }}
        render={
          <PopoverTrigger render={<button type="button" />}>
            <span className="relative inline-flex">
              <Package />
              {isCollapsed && needsUpdate && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute -top-0.5 -right-0.5 size-1.5 rounded-full',
                    deprecatedCount > 0 ? 'bg-destructive-indicator' : 'bg-warning-indicator',
                  )}
                />
              )}
            </span>
            <Sidebar.NavLabel state={state}>
              <span className="tabular-nums">v{version}</span>
            </Sidebar.NavLabel>
            {!isCollapsed && needsUpdate && (
              <Badge variant={badgeVariant} emphasis="subtle" size="xs" className="ml-auto">
                Update
              </Badge>
            )}
          </PopoverTrigger>
        }
      />
      <PopoverContent side="right" align="end" sideOffset={6} className="w-auto p-3">
        <MastraPackagesPanel
          version={version}
          installedPackages={installedPackages}
          packages={packages}
          isLoadingUpdates={isLoading}
          outdatedCount={outdatedCount}
          deprecatedCount={deprecatedCount}
        />
      </PopoverContent>
    </Popover>
  );
};
