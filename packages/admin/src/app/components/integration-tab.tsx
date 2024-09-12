'use client';

import type { Integration } from '@kpl/core';

import { usePathname } from 'next/navigation';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import { IconName } from '@/types/icons';

import { Icon } from './icon';
import { Tab } from './tab';

function buildUrlForIntegration(integration: 'google' | 'mailchimp') {
  return `/records/${integration.toLocaleLowerCase().trim()}`;
}

function isRecordPageActive(name: string, pathname: string) {
  const lowercasedName = name.toLowerCase();
  const [_, path, integration] = pathname.split('/');
  if (lowercasedName === integration && path === 'records') {
    return true;
  }
  return false;
}

function isConnectionPageActive(name: string, pathname: string) {
  const lowercasedName = name.toLowerCase();
  const [_, path, integration] = pathname.split('/');

  if (lowercasedName === integration && path === 'connections') {
    return true;
  }
  return false;
}

export function IntegrationTab({ name }: { name: Integration['name'] }) {
  const url = buildUrlForIntegration(name.toLocaleLowerCase() as 'google' | 'mailchimp');
  const pathname = usePathname();

  const tabActive = isRecordPageActive(name, pathname) || isConnectionPageActive(name, pathname);
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <div className="flex items-center cursor-pointer group justify-between">
          <Tab
            key={name}
            text={name.toLocaleLowerCase()}
            icon={name.toLocaleLowerCase() as IconName}
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
            url={url}
            text="Records"
            icon="records"
            isActive={isRecordPageActive(name, pathname)}
          />
          <Tab
            classname="gap-2 select-none"
            url={`/connections/${name.toLocaleLowerCase()}`}
            text="Connections"
            icon="connections-db"
            isActive={isConnectionPageActive(name, pathname)}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
