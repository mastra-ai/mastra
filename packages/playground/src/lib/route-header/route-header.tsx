import { Breadcrumb, Button, Crumb, DocsIcon, Header, Icon } from '@mastra/playground-ui';
import { Link } from 'react-router';
import { RouteHeaderActionsSlot } from './route-header-actions';
import { useRouteHeader } from './use-route-header';

export function RouteHeader() {
  const { crumbs, docs } = useRouteHeader();
  const lastIdx = crumbs.length - 1;

  return (
    <Header border={false} className="h-10 min-h-10 gap-2 px-2">
      {crumbs.length > 0 && (
        <Breadcrumb label="Breadcrumb">
          {crumbs.map((def, i) => {
            const isCurrent = i === lastIdx;
            const linkable = !isCurrent && def.to;
            const IconComponent = def.icon;
            return (
              <Crumb
                key={`${def.to ?? ''}:${i}`}
                as={linkable ? Link : 'span'}
                to={linkable ? def.to : undefined}
                isCurrent={isCurrent}
              >
                {IconComponent && (
                  <Icon>
                    <IconComponent />
                  </Icon>
                )}
                {def.node}
              </Crumb>
            );
          })}
        </Breadcrumb>
      )}

      <div className="ml-auto flex items-center gap-2">
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
          >
            <DocsIcon />
            <span>{docs.label ?? 'Documentation'}</span>
          </Button>
        )}
      </div>
    </Header>
  );
}
