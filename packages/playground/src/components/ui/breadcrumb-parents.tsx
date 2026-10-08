import { Button } from '@mastra/playground-ui/components/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router';
import { BreadcrumbLabel } from './breadcrumb-label';
import type { CrumbDef } from '@/domains/navigation/crumbs';

/** Compact parent navigation leaves room for the current entity and its switcher. */
export function BreadcrumbParents({ crumbs }: { crumbs: CrumbDef[] }) {
  if (crumbs.length === 0) return null;
  const parent = crumbs[0];
  if (crumbs.length === 1 && parent.to) {
    return (
      <li className="shrink-0">
        <Button render={<Link to={parent.to} />} variant="ghost" size="icon-md">
          <ChevronLeft />
          <span className="sr-only">
            <BreadcrumbLabel crumb={parent} />
          </span>
        </Button>
      </li>
    );
  }
  return (
    <li className="shrink-0">
      <Popover>
        <PopoverTrigger variant="ghost" size="icon-md" aria-label="Parent pages">
          <ChevronLeft />
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-auto max-w-[calc(100vw-1rem)] flex-col gap-1 p-1">
          {crumbs.map(crumb =>
            crumb.to ? (
              <Button key={crumb.id} render={<Link to={crumb.to} />} variant="ghost" className="justify-start">
                <BreadcrumbLabel crumb={crumb} />
              </Button>
            ) : (
              <span key={crumb.id} className="px-3 py-2 text-label text-muted-foreground">
                <BreadcrumbLabel crumb={crumb} />
              </span>
            ),
          )}
        </PopoverContent>
      </Popover>
    </li>
  );
}
