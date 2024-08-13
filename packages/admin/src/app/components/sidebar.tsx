'use client';

import localFont from 'next/font/local';
import { usePathname } from 'next/navigation';

import { Icon } from '@/app/components/ui/svg/icon';
import { IconName } from '@/types/icons';

import { Integration } from '../records/types';

import { Tab } from './tab';
import { TabGroup } from './tab-group';

const links: Array<{
  name: string;
  url: string;
  icon: IconName;
}> = [
  { name: 'workflows', url: '/workflows', icon: 'workflow' },
  { name: 'logs', url: '/logs', icon: 'logs' },
  {
    name: 'records',
    url: '/records',
    icon: 'records',
  },
];

const tasaExplorer = localFont({
  src: '../fonts/TASAExplorerVF.woff2',
  display: 'swap',
  variable: '--tasa-explorer',
});

export const Sidebar = ({ integrations }: { integrations: Integration[] }) => {
  const pathname = usePathname();

  return (
    <div className="relative z-20 h-full text-light-text">
      <div className="bg-main-bg h-full w-full p-4 flex gap-6 flex-col">
        <div className="flex items-center justify-between">
          <div className="flex gap-2 px-2 items-center">
            <p className={`text-medium text-sm  gradient py-[0.38rem] ${tasaExplorer.className}`}>Streamatic</p>
          </div>

          <button>
            <Icon
              name="search"
              className="w-[0.875rem] h-[0.875rem] text-dim-text hover:transition-colors hover:text-light-text"
            />
          </button>
        </div>
        <div className="flex flex-col gap-0.5">
          <TabGroup mb="small">
            {links.map(link => (
              <Tab text={link.name} icon={link.icon} url={link.url} key={link.name} isActive={link.url === pathname} />
            ))}
          </TabGroup>
          <TabGroup>
            <div className="flex flex-col gap-2">
              {integrations.length ? <p className="text-dim-text px-2 text-xs">Integrations</p> : null}
              <div>
                {integrations.map(integration => {
                  const url = `/records/${integration.name.toLocaleLowerCase().trim()}`;
                  return (
                    <Tab
                      key={integration.id}
                      text={integration.name}
                      icon={integration.icon as IconName}
                      url={url}
                      isActive={url === pathname}
                    />
                  );
                })}
              </div>
            </div>
          </TabGroup>
        </div>
      </div>
    </div>
  );
};
