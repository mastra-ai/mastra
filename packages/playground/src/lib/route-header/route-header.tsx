import { Breadcrumb, Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { Button } from '@mastra/playground-ui/components/Button';
import { Header } from '@mastra/playground-ui/components/Header';
import { DocsIcon } from '@mastra/playground-ui/icons/DocsIcon';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { Link } from 'react-router';
import { RouteHeaderActionsSlot } from './route-header-actions';
import { useRouteHeaderCrumbsOverride } from './route-header-crumbs-context';
import type { CrumbDef } from './types';
import { useRouteHeader } from './use-route-header';

function RouteHeaderCrumbContent({ def }: { def: CrumbDef }) {
  if ('Component' in def && def.Component) {
    const Component = def.Component;
    return <Component />;
  }

  if ('node' in def) return <>{def.node}</>;
  return <>{def.label}</>;
}

export function RouteHeader() {
  const { crumbs: handleCrumbs, docs } = useRouteHeader();
  const override = useRouteHeaderCrumbsOverride();
  const crumbs = override ?? handleCrumbs;
  const lastIdx = crumbs.length - 1;

  return (
    <Header border={false} className="h-10 min-h-10 gap-2 overflow-hidden px-2">
      {crumbs.length > 0 && (
        <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden" listClassName="min-w-0">
          {crumbs.map((def, i) => {
            const isCurrent = i === lastIdx;
            const linkable = !isCurrent && def.to;
            const IconComponent = def.icon;
            return (
              <Crumb
                key={def.id}
                as={linkable ? Link : 'span'}
                to={linkable ? def.to : undefined}
                isCurrent={isCurrent}
                className={isCurrent ? 'max-w-[28rem]' : 'max-w-[18rem]'}
              >
                {IconComponent && (
                  <Icon>
                    <IconComponent />
                  </Icon>
                )}
                <RouteHeaderCrumbContent def={def} />
              </Crumb>
            );
          })}
        </Breadcrumb>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2 overflow-hidden">
        <RouteHeaderActionsSlot className="contents" />
        {docs && (
          <Button
            as="a"
            href={docs.href}
            target="_blank"
            rel="noopener noreferrer"
            variant="ghost"
            size="sm"
            aria-label={docs.label ?? 'Documentation'}
            className="max-w-[14rem] min-w-0"
          >
            <DocsIcon />
            <span className="min-w-0 truncate">{docs.label ?? 'Documentation'}</span>
          </Button>
        )}
      </div>
    </Header>
  );
}
