import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';

import { Icon } from '../../icons/Icon';
import { SlashIcon } from '../../icons/SlashIcon';
import { BreadcrumbDisplayContext } from '../Breadcrumb/breadcrumb-display';
import { Popover, PopoverContent, PopoverTrigger } from '../Popover';

export interface PageLayoutMobileHeaderProps {
  breadcrumbs?: ReactNode;
  headerActions?: ReactNode;
}

/**
 * The page's header row as it renders inside `AppShellMobileHeader`: the current crumb (with its
 * switcher and actions) inline, earlier crumbs behind a "…" menu, and page actions on the right.
 */
export function PageLayoutMobileHeader({ breadcrumbs, headerActions }: PageLayoutMobileHeaderProps) {
  const [trailOpen, setTrailOpen] = useState(false);

  // Following a crumb link leaves the page; the menu shouldn't linger over the next one.
  const closeOnLink = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest('a[href]')) setTrailOpen(false);
  };

  return (
    <>
      {breadcrumbs && (
        <div data-slot="page-layout-mobile-crumbs" className="group/crumbs flex min-w-0 flex-1 items-center">
          {/* Shown only when the trail has crumbs before the current one. */}
          <div className="hidden shrink-0 items-center group-has-[ol>li:nth-child(2)]/crumbs:flex">
            <Popover open={trailOpen} onOpenChange={setTrailOpen}>
              <PopoverTrigger variant="ghost" size="icon-sm" aria-label="Show breadcrumb trail">
                <MoreHorizontal />
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-1.5" onClick={closeOnLink}>
                <BreadcrumbDisplayContext.Provider value="stacked">{breadcrumbs}</BreadcrumbDisplayContext.Provider>
              </PopoverContent>
            </Popover>
            <Icon className="text-placeholder">
              <SlashIcon />
            </Icon>
          </div>
          <BreadcrumbDisplayContext.Provider value="current">{breadcrumbs}</BreadcrumbDisplayContext.Provider>
        </div>
      )}
      {headerActions && <div className="ml-auto flex shrink-0 items-center gap-1">{headerActions}</div>}
    </>
  );
}
