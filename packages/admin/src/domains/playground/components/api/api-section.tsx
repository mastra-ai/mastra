import { IntegrationApi } from '@kpl/core';

import Image from 'next/image';
import Link from 'next/link';

import { iconArr } from '@/components/ui/svg/iconArr';
import { Text } from '@/components/ui/text';

import { toTitleCase } from '@/lib/string';
import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';
import { IconName } from '@/types/icons';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

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
      <div className="flex items-center bg-kpl-bg-13 rounded-xs px-4 py-[0.38rem] gap-[0.62rem]">
        <Icon name="trigger" className="text-kpl-el-3" />
        <p className="text-sm">APIs</p>
        <Input placeholder="Search..." className="w-fit ml-auto" onChange={handleSearch} value={search} />
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
                  className="w-[18rem] hover:bg-kpl-bg-4/80 transition-colors flex items-center gap-[0.62rem] bg-kpl-bg-13 px-[0.62rem] py-2 rounded-[0.375rem] border-[0.5px] border-kpl-border-1"
                >
                  <span
                    className={cn(
                      'shrink-0 h-7 w-7 rounded-xs grid place-items-center',
                      iconNoBorder.includes(lowercasedName)
                        ? 'bg-transparent'
                        : lowercasedName === 'system'
                        ? 'bg-kpl-bg-4'
                        : 'bg-kpl-el-6',
                    )}
                  >
                    {iconArr.includes(icon as string) ? (
                      <Icon name={integrationName} />
                    ) : (
                      <Image width={20} height={20} src={apiValue.icon?.icon || ''} alt={integrationName} />
                    )}
                  </span>
                  <div className="w-[18rem] truncate">
                    <Text size={'sm'} weight={'medium'} className="truncate">
                      {toTitleCase(apiName, '_')}
                    </Text>
                    <Text className="text-kpl-el-2 text-[0.6rem]">{apiValue.description} </Text>
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
