'use client';

import React from 'react';

import { Icon } from '@/components/icon';
import Breadcrumb from '@/components/ui/breadcrumbs';
import { CopyButton } from '@/components/ui/copy-button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

import { usePackageManager } from '../../../hooks/use-package-manager';
import { type IntegrationPackage } from '../types';

import { IntegrationItem } from './integration-item';

interface CreateIntegrationClientLayoutProps {
  integrations: IntegrationPackage[];
  redirectURI: string;
}

export const CreateIntegrationClientLayout = ({ integrations, redirectURI }: CreateIntegrationClientLayoutProps) => {
  const { packageManager, updatePackageManager } = usePackageManager();
  const [searchTerm, setSearchTerm] = React.useState('');

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const filteredIntegrations = React.useMemo(
    () =>
      integrations.filter(int => {
        return int.name.toLowerCase().includes(searchTerm.toLowerCase());
      }),
    [searchTerm],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="sticky top-0">
        <div className="flex h-[var(--top-bar-height)] w-full content-center items-center justify-between border-b-[0.1px] border-primary-border px-[1.31rem]">
          <div className="inline-flex h-[26px] w-[125px] items-center justify-start gap-3">
            <Breadcrumb
              items={[
                {
                  label: 'Integrations',
                  href: `/integrations`,
                },
                {
                  label: 'New Integration',
                  href: ``,
                  isCurrent: true,
                },
              ]}
              pageClassName="font-medium whitespace-nowrap"
            />
          </div>
          <pre className="flex bg-transparent  items-center gap-2 justify-between  px-2 rounded font-mono text-[0.75rem]">
            <code>
              <span className="font-medium">RedirectURI</span>{' '}
              <span className="text-mastra-el-3 bg-mastra-bg-4 p-1 px-2 rounded-sm">{redirectURI}</span>
            </code>
            <CopyButton classname="" snippet={redirectURI} />
          </pre>
        </div>
      </div>
      <ScrollArea>
        <div className="px-3 mx-auto max-w-[40em] h-full pb-5">
          <div className="sticky top-0 z-20 pt-11 pb-12 bg-mastra-bg-2">
            <h1 className="mb-[18px] text-2xl font-medium">Integration Library</h1>
            <div className="relative ">
              <Icon name="search" className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
              <Input
                className="bg-gray-400/5 px-9 py-4 text-ellipsis"
                placeholder="Search available integrations"
                value={searchTerm}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="grid grid-cols-[repeat(3,minmax(0,200px))] gap-3">
            {filteredIntegrations.map(integration => {
              return (
                <IntegrationItem
                  packageManager={packageManager}
                  key={integration.name}
                  updatePkgManager={updatePackageManager}
                  integration={integration}
                />
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
