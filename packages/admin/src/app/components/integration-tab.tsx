'use client';

import { usePathname } from 'next/navigation';

import { Integration } from '@/domains/plugins/types';
import { IconName } from '@/types/icons';

import { Tab } from './tab';

export function IntegrationTab({ name }: { name: Integration['name'] }) {
  const url = `/records/${name.toLocaleLowerCase().trim()}`;
  const pathname = usePathname();

  return (
    <Tab
      key={name}
      text={name.toLocaleLowerCase()}
      icon={name.toLocaleLowerCase() as IconName}
      url={url}
      isActive={url === pathname}
      isConnected={false}
    />
  );
}
