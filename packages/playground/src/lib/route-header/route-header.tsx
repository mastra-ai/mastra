import { Breadcrumb, Crumb, useBreadcrumbItem } from '@mastra/playground-ui/components/Breadcrumb';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { RouteHeaderActionsSlot } from './route-header-actions';
import { useRouteHeaderCrumbsOverride } from './route-header-crumbs-context';
import type { CrumbDef } from './types';
import { useRouteHeader } from './use-route-header';

function routeHeaderCrumbContent(def: CrumbDef): ReactNode {
  if ('Component' in def && def.Component) {
    const Component = def.Component;
    return <Component />;
  }

  if ('node' in def) return def.node;
  return def.label;
}

function RouteHeaderCrumb({ def }: { def: CrumbDef }) {
  const item = useBreadcrumbItem();
  const isCurrent = item?.isLeaf ?? false;
  const to = isCurrent ? undefined : item?.pathname;
  const IconComponent = def.icon;
  const Action = def.Action;

  return (
    <Crumb
      as={to ? Link : 'span'}
      to={to}
      isCurrent={isCurrent}
      icon={IconComponent ? <IconComponent /> : undefined}
      action={Action ? <Action /> : undefined}
    >
      {routeHeaderCrumbContent(def)}
    </Crumb>
  );
}

export function RouteHeader() {
  const { crumbs: handleCrumbs } = useRouteHeader();
  const override = useRouteHeaderCrumbsOverride();
  const crumbs = override ?? handleCrumbs;

  return (
    <Breadcrumb.Bar actions={<RouteHeaderActionsSlot className="contents" />}>
      {crumbs.map(def => (
        <Breadcrumb.Item key={def.id} pathname={def.to}>
          <RouteHeaderCrumb def={def} />
        </Breadcrumb.Item>
      ))}
    </Breadcrumb.Bar>
  );
}
