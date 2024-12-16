'use client';

import { usePathname } from 'next/navigation';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import { capitalizeFirstLetter } from '@/lib/string';

import { IntegrationLogo } from '@/domains/integrations/components/integration-logo';
import {
  IntegrationWithConnectionAndEntityTypes,
  entityTypeToIcon,
  entityTypeToLabelMap,
} from '@/domains/integrations/types';

import { Icon } from './icon';
import { Tab } from './tab';

function buildUrlForIntegration({
  path,
  integration,
  entityType,
}: {
  path: string;
  integration: string;
  entityType?: string;
}) {
  return `/${path}/${integration.toLocaleLowerCase()?.trim()}${
    entityType ? `/${entityType?.toLocaleLowerCase()?.trim()}` : ''
  }`;
}

function isPageActive({ name, pathname, routePath }: { name: string; pathname: string; routePath: string }) {
  const lowercasedName = name.toLowerCase();
  const [_, path, integration] = pathname.split('/');
  if (lowercasedName === integration && path === routePath) {
    return true;
  }
  return false;
}

function isEntityPageActive({
  name,
  pathname,
  routePath,
  entityType,
}: {
  name: string;
  pathname: string;
  routePath: string;
  entityType: string;
}) {
  const lowercasedName = name.toLowerCase();
  const [_, path, integration, entity] = pathname.split('/');
  if (lowercasedName === integration && path === routePath && entity === entityType.toLowerCase()) {
    return true;
  }
  return false;
}

export function isTabActive({
  name,
  pathname,
  routePaths,
}: {
  name: string;
  pathname: string;
  routePaths: Array<string>;
}) {
  const lowercasedName = name.toLowerCase();
  const [_, path, integration] = pathname.split('/');
  if (lowercasedName === integration && routePaths.includes(path)) {
    return true;
  }
  return false;
}

export function IntegrationTab({
  name,
  logoUrl,
  connections,
  entityTypes,
}: Pick<IntegrationWithConnectionAndEntityTypes, 'name' | 'logoUrl' | 'connections' | 'entityTypes'>) {
  const setupUrl = buildUrlForIntegration({ path: 'settings', integration: name });
  const connectionsUrl = buildUrlForIntegration({ path: 'connections', integration: name });
  const pathname = usePathname();

  const entityRoutes = entityTypes.map(entityType => ({
    label: entityTypeToLabelMap[entityType] || capitalizeFirstLetter(entityType),
    icon: entityTypeToIcon[entityType] || 'activity',
    path: buildUrlForIntegration({ path: 'records', integration: name, entityType }),
    entityType,
  }));

  const tabActive = isTabActive({ name, pathname, routePaths: ['settings', 'records', 'connections'] });
  return (
    <Collapsible defaultOpen={tabActive}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center cursor-pointer group justify-between">
          <Tab
            key={name}
            text={name.toLocaleLowerCase()}
            icon={<IntegrationLogo name={name} logoUrl={logoUrl} withConnectionsDot={!!connections} imageSize={11} />}
            url={'#'}
            isActive={tabActive}
            as="div"
            classname="select-none"
          >
            <Icon
              name="caret"
              className="h-2 w-2 text-mastra-el-3 group-data-[state=closed]:-rotate-90 transition-transform duration-100 ease-[cubic-bezier(0.455_0.03_0.515_0.955)]"
            />
          </Tab>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="CollapsibleContent">
        <div className="flex flex-col pt-1 gap-1 pl-6 pr-0">
          <Tab
            classname="gap-2 select-none"
            url={setupUrl}
            text="Setup"
            icon="settings"
            isActive={isPageActive({ name, pathname, routePath: 'settings' })}
          />
          <Tab
            classname="gap-2 select-none"
            url={connectionsUrl}
            text="Connections"
            icon="activity"
            isActive={isPageActive({ name, pathname, routePath: 'connections' })}
          />
          {entityRoutes?.map(({ icon, label, path, entityType }) => (
            <Tab
              key={entityType}
              classname="gap-2 select-none"
              url={path}
              text={`${label}${label?.[label?.length - 1] === 's' ? '' : 's'}`}
              icon={icon}
              isActive={isEntityPageActive({ name, pathname, routePath: 'records', entityType })}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
