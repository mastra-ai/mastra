import type { ComponentType, ReactNode, SVGProps } from 'react';

import { Breadcrumb, Crumb } from '@/ds/components/Breadcrumb';
import type { LinkComponent } from '@/ds/types/link-component';

export type CrumbIcon = ComponentType<SVGProps<SVGSVGElement>>;

interface CrumbBase {
  /** Stable identifier used as the React key. Prefer semantic ids like `agent` or `dataset-item`. */
  id: string;
  to?: string;
  icon?: CrumbIcon;
  /** Hook-driven control rendered next to the crumb label (e.g. an icon-only entity switcher). */
  Action?: ComponentType;
}

export type CrumbDef = CrumbBase &
  (
    | { label: string; node?: never; Component?: never }
    | { node: ReactNode; label?: never; Component?: never }
    | { Component: ComponentType; label?: never; node?: never }
  );

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
  /** Router-aware link used for every crumb except the current one. */
  LinkComponent: LinkComponent;
}

/** Renders a crumb list; the last crumb is the current page and never links. */
export function PageBreadcrumbs({ crumbs, LinkComponent }: PageBreadcrumbsProps) {
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
            as={linkable ? LinkComponent : 'span'}
            href={linkable ? def.to : undefined}
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
