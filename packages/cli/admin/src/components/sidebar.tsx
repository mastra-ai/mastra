'use client';

import { ReactNode } from 'react';

import { usePathname } from 'next/navigation';

import { IconName } from '@/types/icons';

import Icon from './icon';
import { Tab } from './tab';
import { TabGroup } from './tab-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

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
  if (lowercasedName === path || routePaths.includes(path)) {
    return true;
  }
  return false;
}

type SidebarItem = {
  name: string;
  url: string;
  icon: IconName;
  subItem?: Array<SidebarItem>;
};

const links: Array<SidebarItem> = [
  {
    name: 'agents',
    url: '/agents',
    icon: 'agent',
  },
  {
    name: 'RAG Sync',
    url: '/rag',
    icon: 'sync',
  },
  {
    name: 'integrations',
    url: '/integrations',
    icon: 'blocks',
    subItem: [
      {
        name: 'All',
        url: '/integrations',
        icon: 'blocks',
      },
      {
        name: 'playground',
        url: '/playground',
        icon: 'playground',
      },
    ],
  },
  { name: 'workflows', url: '/workflows', icon: 'workflow' },

  { name: 'logs', url: '/logs', icon: 'logs' },
];

export const Sidebar = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const path = pathname.split('/')[1];

  return (
    <div className="relative z-20 h-full text-mastra-el-6">
      <div className="bg-mastra-bg-1 h-full w-full p-4 flex gap-6 flex-col">
        <div className="flex items-center justify-between">
          <div className="flex gap-2 px-2 items-center">
            <Icon name="logo" />
            <p className="text-medium text-sm  gradient py-[0.38rem] font-tasa">Mastra</p>
          </div>
        </div>

        <div>
          <TabGroup mb="small">
            <div className="flex flex-col gap-0.5">
              {links.map(link => {
                if (link.subItem) {
                  return (
                    <Collapsible key={link.name} defaultOpen={false}>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center cursor-pointer group justify-between">
                          <Tab
                            key={link.name}
                            text={link.name.toLocaleLowerCase()}
                            icon={link.icon}
                            url={'#'}
                            isActive={isTabActive({
                              name: link.name,
                              pathname,
                              routePaths: ['integrations', 'playground'],
                            })}
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
                          {link.subItem?.map(({ icon, name, url }) => (
                            <Tab
                              key={name}
                              classname="gap-2 select-none"
                              url={url}
                              text={name}
                              icon={icon}
                              isActive={url === pathname || name === path || url.includes(path)}
                            />
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                }
                return (
                  <Tab
                    text={link.name}
                    icon={link.icon}
                    url={link.url}
                    key={link.name}
                    isActive={link.url === pathname || link.name === path || link.url.includes(path)}
                  />
                );
              })}
            </div>
          </TabGroup>

          <TabGroup>
            <div className="flex flex-col gap-2">
              <p className="text-mastra-el-3 px-2 text-xs">Installed</p>
              <div className="flex flex-col gap-0.5">{children}</div>
            </div>
          </TabGroup>
        </div>
      </div>
    </div>
  );
};
