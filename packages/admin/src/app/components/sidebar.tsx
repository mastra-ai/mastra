'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Icon } from '@/components/ui/svg/icon';

import logo from '@/icons/logo.svg';
import search from '@/icons/search.svg';

import { cn } from '@/lib/utils';

import { IconName } from '@/types/icons';

const links: Array<{
  name: string;
  url: string;
  icon: IconName;
}> = [
  { name: 'workflows', url: 'workflows', icon: 'workflow' },
  { name: 'logs', url: 'logs', icon: 'logs' },
  {
    name: 'records',
    url: 'records',
    icon: 'records',
  },
];

function Tab({ text, url, isActive, icon }: { text: string; url: string; isActive: boolean; icon: IconName }) {
  return (
    <Link
      href={url}
      className={cn(
        'flex w-full px-2 items-center gap-3 transition-all rounded-xs group text-small hover:bg-light-text/5',
        isActive ? 'bg-light-text/5' : '',
      )}
    >
      <Icon
        name={icon}
        className={cn(
          'w-[0.875rem] h-[0.875rem] text-dim-text group-hover:text-light-text',
          isActive ? 'text-light-text' : '',
        )}
      />
      <p
        className={cn(
          'py-[0.38rem] group-hover:text-light-text transition-all text-dim-text capitalize ',
          isActive ? 'text-light-text' : '',
        )}
      >
        {text}
      </p>
    </Link>
  );
}

export const Sidebar = () => {
  const pathname = usePathname();
  const splitPathname = pathname.split('/');
  const currentNavItem = splitPathname[splitPathname.length - 1];

  return (
    <div className="relative z-20 h-full text-light-text">
      <div className="bg-main-bg h-full w-full p-4 flex gap-10 flex-col">
        <div className="flex items-center justify-between">
          <div className="flex gap-2 px-2 items-center">
            <Image
              src={logo}
              alt="strematic logo"
              width={21}
              height={21}
              className="w-[1.25rem]  h-[1.25rem]"
              priority
            />
            <p className="text-medium text-sm text-light-text py-[0.38rem]">Streamatic</p>
          </div>

          <button>
            <Image src={search} alt="search " width={21} height={21} className="w-[0.875rem] h-[0.875rem]" priority />
          </button>
        </div>
        <div className="flex flex-col gap-0.5">
          {links.map(link => (
            <Tab
              text={link.name}
              icon={link.icon}
              url={link.url}
              key={link.name}
              isActive={link.url === currentNavItem}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
