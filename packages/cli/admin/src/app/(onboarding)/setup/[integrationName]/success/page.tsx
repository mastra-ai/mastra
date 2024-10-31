import React from 'react';

import Image from 'next/image';
import Link from 'next/link';

import { Icon } from '@/components/icon';

import { framework } from '@/lib/framework-utils';
import { capitalizeFirstLetter } from '@/lib/string';
import { cn } from '@/lib/utils';

import { getIntegrations } from '@/domains/integrations/utils';
import { getSyncedData } from '@/domains/onboarding/actions';
import { SyncedData } from '@/domains/onboarding/components/synced-data';
import { SyncedDataItem } from '@/domains/onboarding/types';
import { IconName } from '@/types/icons';

const entityTypeToIcon: Record<string, IconName> = {
  EMAIL: 'envelope',
  CONTACTS: 'user',
  CALENDAR: 'calendar',
  ACTION: 'activity',
};

const entityTypeToLabelMap: Record<string, string> = {
  CONTACTS: 'Contact',
  CALENDAR: 'Calendar Event',
};

const SuccessIntegrationPage = async (props: {
  params: Promise<{ integrationName: string }>;
  searchParams: Promise<{ connectionId: string }>;
}) => {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const apis = framework?.globalApis.get(params.integrationName?.toUpperCase()) || {};
  const integrations = await getIntegrations();
  const integrationFound = integrations.find(i => i.name.toLowerCase() === params.integrationName.toLowerCase());
  const integrationName = capitalizeFirstLetter(params.integrationName);
  const { entityTypes, entityToRecordCountMap } = await getSyncedData({
    connectionId: searchParams.connectionId,
    integrationName: params.integrationName,
  });

  const dashboardLinks = [
    {
      icon: 'grid',
      title: 'To Integration Data',
      description: 'I want to get data and play around with it in my app ',
      href: `/records/${params.integrationName.toLowerCase()}?connectionId=${searchParams.connectionId}`,
    },
    {
      icon: 'code',
      title: 'To Event Playground',
      description: 'I want to manipulate the app with events',
      href: `/playground`,
    },
    {
      icon: 'block',
      title: 'To Integrations Library',
      description: 'I want to connect another integration',
      href: '/integrations',
    },
  ];

  const entityTypesData = Object.keys(entityTypes).map(entityType => ({
    label: entityTypeToLabelMap[entityType] || capitalizeFirstLetter(entityType),
    icon: entityTypeToIcon[entityType] || 'activity',
    type: entityType,
    count: entityToRecordCountMap[entityType] || 0,
  }));

  const apiCount = Object.keys(apis).length || 0;

  const syncedData: SyncedDataItem[] = [
    ...entityTypesData,
    {
      label: 'Api',
      icon: 'activity',
      type: 'ACTION',
      count: apiCount,
    },
  ];

  return (
    <div className="h-[600px] flex w-[920px]">
      <div className="p-11 bg-[#D9D9D9]/[0.02] h-full flex flex-col justify-between max-w-[360px]">
        <div>
          <Link className="text-[#5699A8] flex gap-1.5 text-xs" href={`/setup/${params.integrationName}/connect`}>
            <Icon className="-rotate-90" name="arrow-up" width={12} height={12} />
            <span>Back</span>
          </Link>
          <h3 className="text-[22px] mt-2 font-medium font-tasa">
            Success! You&rsquo;ve connected {integrationName} to your account!
          </h3>

          <p className="text-xs text-[#A6A6A6] mt-2.5">Choose what you want to do next.</p>
        </div>
        <div className="mt-auto">
          {dashboardLinks.map(({ title, description, href, icon }, index) => {
            const isLast = index === dashboardLinks.length - 1;
            return (
              <div key={title}>
                <p className="text-[#5c5c5c] text-xs">{description}</p>
                <Link
                  href={href}
                  className={cn(
                    'bg-[#262626] justify-center border hover:bg-mastra-bg-5 transition-colors duration-150 border-mastra-border-2/60 rounded-sm py-2.5 text-xs font-medium flex gap-2',
                    isLast ? 'mt-4' : 'my-4',
                  )}
                >
                  <Icon name={icon as IconName} width={14} height={14} />
                  <span>{title}</span>
                </Link>
                {!isLast && <hr className=" border-mastra-border-1/90 mb-4"></hr>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex-1 h-full p-11 relative bg-mastra-bg-2 rounded-r-[4px]">
        <div className="flex mb-11 items-center justify-between">
          <div className="flex gap-3 items-center">
            <div className="w-[50px] h-[50px] rounded-[6px] bg-white/[0.07] flex items-center justify-center">
              <Image src={integrationFound?.logoUrl || ''} alt={integrationName} width={40} height={40} />
            </div>
            <div className="font-medium">
              <h3 className="text-[#E6E6E6]">{integrationName}</h3>
              <p className="text-mastra-el-3">Connected</p>
            </div>
          </div>

          {/* <button className='text-mastra-el-3'>
            <Icon name="documentation" width={14} height={14} />
            </button> */}
        </div>
        <SyncedData
          connectionId={searchParams.connectionId}
          integrationName={params.integrationName}
          syncedData={syncedData}
        />
      </div>
    </div>
  );
};

export default SuccessIntegrationPage;
