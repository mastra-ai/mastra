import { IntegrationApi } from '@kpl/core';

import Image from 'next/image';
import Link from 'next/link';

import { Text } from '@/components/ui/text';

import { toTitleCase } from '@/lib/string';
import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';
import { IconName } from '@/types/icons';

function ApiSection({ integrationName, apis }: { integrationName: IconName; apis: Record<string, IntegrationApi> }) {
  return (
    <div className="flex flex-col gap-[0.62rem]">
      <div className="flex items-center bg-kpl-bg-13 rounded-xs px-4 py-[0.38rem] gap-[0.62rem]">
        <Icon name="trigger" className="text-kpl-el-3" />
        <p className="text-sm">APIs</p>
      </div>
      <div className="flex max-h-[50vh] overflow-scroll flex-wrap gap-2 ">
        {apis
          ? Object.entries(apis).map(item => {
              const [apiName, apiValue] = item;

              return (
                <Link
                  href={`/playground/api/${integrationName}/${apiName.toLowerCase()}`}
                  key={apiName}
                  className="w-[18rem] hover:bg-kpl-bg-4/80 transition-colors flex items-center gap-[0.62rem] bg-kpl-bg-13 px-[0.62rem] py-2 rounded-[0.375rem] border-[0.5px] border-kpl-border-1"
                >
                  <span
                    className={cn(
                      'shrink-0 h-7 w-7 rounded-xs grid place-items-center',
                      integrationName.toLocaleLowerCase() === 'x' ? 'bg-transparent' : 'bg-kpl-el-6 ',
                    )}
                  >
                    <Image width={20} height={20} src={apiValue.icon?.icon || ''} alt={integrationName} />
                    {/* <Icon name={integrationName} /> */}
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
