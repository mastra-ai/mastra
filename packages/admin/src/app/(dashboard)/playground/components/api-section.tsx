import { IntegrationApi } from '@arkw/core';

import Image from 'next/image';

import { Text } from '@/components/ui/text';

import { toTitleCase } from '@/lib/string';

import { Icon } from '@/app/components/icon';
import { IconName } from '@/types/icons';

function ApiSection({ integrationName, apis }: { integrationName: IconName; apis: Record<string, IntegrationApi> }) {
  return (
    <div className="flex flex-col gap-[0.62rem]">
      <div className="flex items-center bg-arkw-bg-13 rounded-xs px-4 py-[0.38rem] gap-[0.62rem]">
        <Icon name="trigger" className="text-arkw-el-3" />
        <p className="text-sm">APIs</p>
      </div>
      <div className="flex flex-wrap gap-2 ">
        {Object.entries(apis).map(item => {
          const [apiName, apiValue] = item;
          return (
            <div
              key={apiName}
              className="w-[18rem] flex items-center gap-[0.62rem] bg-arkw-bg-13 px-[0.62rem] py-2 rounded-[0.375rem] border-[0.5px] border-arkw-border-1"
            >
              <span className="bg-arkw-el-6 h-7 w-7 rounded-xs grid place-items-center">
                <Image width={20} height={20} src={apiValue.icon?.icon || ''} alt={integrationName} />
                {/* <Icon name={integrationName} /> */}
              </span>
              <div>
                <Text size={'sm'} weight={'medium'}>
                  {toTitleCase(apiName, '_')}
                </Text>
                <Text className="text-arkw-el-2 text-[0.6rem]">{apiValue.description} </Text>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { ApiSection };
