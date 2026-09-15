import { Breadcrumb, Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { Header } from '@mastra/playground-ui/components/Header';
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

export function RouteHeader() {
  const { crumbs: handleCrumbs } = useRouteHeader();
  const override = useRouteHeaderCrumbsOverride();
  const crumbs = override ?? handleCrumbs;
  const lastIdx = crumbs.length - 1;

  return (
    <Header className="h-10 min-h-10 gap-2 overflow-hidden px-2">
      {crumbs.length > 0 && (
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
                {routeHeaderCrumbContent(def)}
              </Crumb>
            );
          })}
        </Breadcrumb>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2 overflow-hidden">
        <RouteHeaderActionsSlot className="contents" />
      </div>
    </Header>
  );
}
