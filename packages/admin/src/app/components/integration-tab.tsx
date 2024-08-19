'use client';

import { usePathname } from 'next/navigation';

import { Integration } from '@/domains/plugins/types';
import { IconName } from '@/types/icons';

import { Tab } from './tab';

function buildUrlForIntegration(integration: 'google' | 'mailchimp') {
  if (integration === 'google') {
    return `/records/${integration.toLocaleLowerCase().trim()}?table=contacts`;
  }
  return `/records/${integration.toLocaleLowerCase().trim()}`;
}

export function IntegrationTab({ name }: { name: Integration['name'] }) {
  const url = buildUrlForIntegration(name.toLocaleLowerCase() as 'google' | 'mailchimp');
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
