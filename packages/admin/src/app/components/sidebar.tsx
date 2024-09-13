'use client';

import { ReactNode } from 'react';

import { usePathname } from 'next/navigation';

import { Icon } from '@/app/components/icon';
import { IconName } from '@/types/icons';

import { Tab } from './tab';
import { TabGroup } from './tab-group';

const links: Array<{
  name: string;
  url: string;
  icon: IconName;
}> = [
  {
    name: 'integrations',
    url: '/integrations',
    icon: 'blocks',
  },
  { name: 'workflows', url: '/workflows', icon: 'workflow' },
  {
    name: 'playground',
    url: '/playground',
    icon: 'playground',
  },
  { name: 'logs', url: '/logs', icon: 'logs' },
];

export const Sidebar = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const path = pathname.split('/')[1];

  return (
    <div className="relative z-20 h-full text-kpl-el-6">
      <div className="bg-kpl-bg-1 h-full w-full p-4 flex gap-6 flex-col">
        <div className="flex items-center justify-between">
          <div className="flex gap-2 px-2 items-center">
            <p className="text-medium text-sm  gradient py-[0.38rem] font-tasa">Kepler</p>
          </div>

          <button>
            <Icon
              name="search"
              className="w-[0.875rem] h-[0.875rem] text-kpl-el-3 hover:transition-colors hover:text-kpl-el-6"
            />
          </button>
        </div>

        <div>
          <TabGroup mb="small">
            <div className="flex flex-col gap-0.5">
              {links.map(link => (
                <Tab
                  text={link.name}
                  icon={link.icon}
                  url={link.url}
                  key={link.name}
                  isActive={link.url === pathname || link.name === path}
                />
              ))}
            </div>
          </TabGroup>

          <TabGroup>
            <div className="flex flex-col gap-2">
              <p className="text-kpl-el-3 px-2 text-xs">Installed</p>
              <div className="flex flex-col gap-0.5">{children}</div>
            </div>
          </TabGroup>
        </div>
      </div>
    </div>
  );
};
