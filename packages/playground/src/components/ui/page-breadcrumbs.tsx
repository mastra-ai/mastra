import { Breadcrumb, Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { Link } from 'react-router';
import { BreadcrumbLabel } from './breadcrumb-label';
import { BreadcrumbParents } from './breadcrumb-parents';
import type { CrumbDef } from '@/domains/navigation/crumbs';

export interface PageBreadcrumbsProps {
  crumbs: CrumbDef[];
}

/** Renders a crumb list; the last crumb is the current page and never links. */
export function PageBreadcrumbs({ crumbs }: PageBreadcrumbsProps) {
  const isMobile = useIsMobile();
  if (crumbs.length === 0) return null;
  const lastIdx = crumbs.length - 1;
  const visibleCrumbs = isMobile ? crumbs.slice(-1) : crumbs;

  return (
    <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden" listClassName="min-w-0">
      {isMobile && <BreadcrumbParents crumbs={crumbs.slice(0, -1)} />}
      {visibleCrumbs.map((def, i) => {
        const isCurrent = isMobile || i === lastIdx;
        const linkable = !isCurrent && def.to;
        const IconComponent = def.icon;
        const Action = def.Action;
        const Switcher = def.Switcher;
        return (
          <Crumb
            key={def.id}
            as={linkable ? Link : 'span'}
            to={linkable ? def.to : undefined}
            isCurrent={isCurrent}
            icon={IconComponent ? <IconComponent /> : undefined}
            action={Action ? <Action /> : undefined}
            switcher={Switcher ? <Switcher /> : undefined}
            className={isMobile ? 'px-1' : undefined}
          >
            <BreadcrumbLabel crumb={def} />
          </Crumb>
        );
      })}
    </Breadcrumb>
  );
}
