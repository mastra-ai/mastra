import { Breadcrumb, Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { CrumbDef } from '@/domains/navigation/crumbs';

function crumbContent(def: CrumbDef): ReactNode {
  if ('Component' in def && def.Component) {
    const Component = def.Component;
    return <Component />;
  }
  if ('node' in def) return def.node;
  return def.label;
}

export interface PageBreadcrumbsProps {
  crumbs: CrumbDef[];
}

/** Renders a crumb list; the last crumb is the current page and never links. */
export function PageBreadcrumbs({ crumbs }: PageBreadcrumbsProps) {
  if (crumbs.length === 0) return null;
  const lastIdx = crumbs.length - 1;

  return (
    <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden" listClassName="min-w-0">
      {crumbs.map((def, i) => {
        const isCurrent = i === lastIdx;
        const linkable = !isCurrent && def.to;
        const IconComponent = def.icon;
        const Action = def.Action;
        return (
          <Crumb
            key={def.id}
            as={linkable ? Link : 'span'}
            to={linkable ? def.to : undefined}
            isCurrent={isCurrent}
            icon={IconComponent ? <IconComponent /> : undefined}
            action={Action ? <Action /> : undefined}
          >
            {crumbContent(def)}
          </Crumb>
        );
      })}
    </Breadcrumb>
  );
}
