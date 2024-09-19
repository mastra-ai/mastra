'use client';

import { usePathname } from 'next/navigation';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import { IntegrationLogo } from '@/domains/integrations/components/integration-logo';
import { IntegrationWithConnection } from '@/domains/integrations/types';

import { Icon } from './icon';
import { Tab } from './tab';

function buildUrlForIntegration(path: string, integration: string) {
  return `/${path}/${integration.toLocaleLowerCase().trim()}`;
}

function isPageActive({ name, pathname, routePath }: { name: string; pathname: string; routePath: string }) {
  const lowercasedName = name.toLowerCase();
  const [_, path, integration] = pathname.split('/');
  if (lowercasedName === integration && path === routePath) {
    return true;
  }
  return false;
}

function isTabActive({ name, pathname }: { name: string; pathname: string }) {
  const routePaths = ['settings', 'records', 'connections'];
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
}: Pick<IntegrationWithConnection, 'name' | 'logoUrl' | 'connections'>) {
  const setupUrl = buildUrlForIntegration('settings', name.toLocaleLowerCase());
  const recordsUrl = buildUrlForIntegration('records', name.toLocaleLowerCase());
  const connectionsUrl = buildUrlForIntegration('connections', name.toLocaleLowerCase());
  const pathname = usePathname();

  const tabActive = isTabActive({ name, pathname });
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
              className="h-2 w-2 text-kpl-el-3 group-data-[state=closed]:-rotate-90 transition-transform duration-100 ease-[cubic-bezier(0.455_0.03_0.515_0.955)]"
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
            url={recordsUrl}
            text="Records"
            icon="records"
            isActive={isPageActive({ name, pathname, routePath: 'records' })}
          />
          <Tab
            classname="gap-2 select-none"
            url={connectionsUrl}
            text="Connections"
            icon="activity"
            isActive={isPageActive({ name, pathname, routePath: 'connections' })}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
