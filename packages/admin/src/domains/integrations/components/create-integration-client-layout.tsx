'use client';

import React from 'react';

import Breadcrumb from '@/components/ui/breadcrumbs';
import { Input } from '@/components/ui/input';

import { Icon } from '@/app/components/icon';
import { getPackageManager } from '@/app/packages/actions';

import { IntegrationNameAndLogo } from '../types';

import { IntegrationItem } from './integration-item';

export const pkgManagerToCommandMap = {
  npm: 'install',
  yarn: 'add',
  pnpm: 'add',
};

type PkgManagers = keyof typeof pkgManagerToCommandMap;

interface CreateIntegrationClientLayoutProps {
  integrations: IntegrationNameAndLogo[];
}

// let packageInstalled = false;
export const CreateIntegrationClientLayout = ({ integrations }: CreateIntegrationClientLayoutProps) => {
  const [packageManager, setPackageManager] = React.useState<PkgManagers>('npm');
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

  const updatePackageManager = async () => {
    setPackageManager(await getPackageManager());
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0">
        <div className="flex h-[var(--top-bar-height)] w-full content-center items-center justify-between border-b-[0.1px] border-primary-border px-[1.31rem]">
          <div className="inline-flex h-[26px] w-[125px] items-center justify-start gap-3">
            <Breadcrumb
              items={[
                {
                  label: 'Create integration',
                  href: ``,
                  isCurrent: true,
                },
              ]}
              pageClassName="font-medium"
            />
          </div>
        </div>
      </div>
      <div className="px-3 mx-auto max-w-[40em]">
        <div className="my-6 relative ">
          <Icon name="search" className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
          <Input
            className="bg-gray-400/5 px-9 py-4 text-ellipsis"
            placeholder="Search available integrations"
            value={searchTerm}
            onChange={handleInputChange}
          />
        </div>

        <div className="grid grid-cols-[repeat(3,minmax(0,200px))] gap-y-3">
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
    </div>
  );
};
