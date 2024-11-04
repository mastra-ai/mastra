'use client';

import { IntegrationApi } from '@mastra/core';
import { useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import { Icon } from '@/components/icon';
import { Input } from '@/components/ui/input';
import { iconArr } from '@/components/ui/svg/iconArr';
import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';

import { IntegrationLogo } from '@/domains/integrations/components/integration-logo';
import { IconName } from '@/types/icons';

function ApiSection({ integrationName, apis }: { integrationName: IconName; apis: Record<string, IntegrationApi> }) {
  const iconNoBorder = ['x'];
  const lowercasedName = integrationName.toLocaleLowerCase();
  const [search, setSearch] = useState('');
  const [filteredApis, setFilteredApis] = useState<Record<string, IntegrationApi>>(apis);

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setFilteredApis(
      Object.entries(apis).reduce((acc, [apiName, apiValue]) => {
        if (apiName.toLowerCase().includes(e.target.value.toLowerCase())) {
          acc[apiName] = apiValue;
        }
        return acc;
      }, {} as Record<string, IntegrationApi>),
    );
  }

  return (
    <div className="flex flex-col gap-[0.62rem]">
      <div className="flex items-center bg-mastra-bg-13 rounded-xs px-4 py-[0.38rem] gap-[0.62rem]">
        <Icon name="trigger" className="text-mastra-el-3" />
        <p className="text-sm">APIs</p>
        <Input placeholder="Search Apis..." className="w-fit ml-auto" onChange={handleSearch} value={search} />
      </div>
      <div className="flex max-h-[50vh] overflow-scroll flex-wrap gap-2 ">
        {apis
          ? Object.entries(filteredApis).map(item => {
              const [apiName, apiValue] = item;

              const icon = apiValue.icon?.icon;

              return (
                <Link
                  href={`/playground/api/${integrationName}?name=${apiName.toLowerCase()}`}
                  key={apiName}
                  className="w-[18rem] hover:bg-mastra-bg-4/80 transition-colors flex items-center gap-[0.62rem] bg-mastra-bg-13 px-[0.62rem] py-2 rounded-[0.375rem] border-[0.5px] border-mastra-border-1"
                >
                  {integrationName === 'system' ? (
                    <span
                      className={cn(
                        'shrink-0 h-7 w-7 rounded-xs grid place-items-center',
                        iconNoBorder.includes(lowercasedName)
                          ? 'bg-transparent'
                          : lowercasedName === 'system'
                          ? 'bg-mastra-bg-4'
                          : 'bg-mastra-el-6',
                      )}
                    >
                      {iconArr.includes(icon as string) || !icon ? (
                        <Icon name={integrationName} />
                      ) : (
                        <Image width={20} height={20} src={apiValue.icon?.icon || ''} alt={integrationName} />
                      )}
                    </span>
                  ) : (
                    <IntegrationLogo logoUrl={apiValue.icon?.icon || ''} name={integrationName} />
                  )}
                  <div className="w-[18rem] truncate">
                    <Text size={'sm'} weight={'medium'} className="truncate">
                      {apiValue.label}
                    </Text>
                    <Text className="text-mastra-el-2 text-[0.6rem]">{apiValue.description} </Text>
                  </div>
                </Link>
              );
            })
          : null}
      </div>
    </div>
  );
}

export { ApiSection };
