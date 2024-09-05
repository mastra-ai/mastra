import React from 'react';

import Image from 'next/image';
import Link from 'next/link';

import { capitalizeFirstLetter } from '@/lib/string';
import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';
import { getIntegrations } from '@/domains/integrations/utils';
import { IconName } from '@/types/icons';

const SuccessIntegrationPage = async ({ params }: { params: { integrationName: string } }) => {
  const integrations = await getIntegrations();
  const integration = integrations.find(i => i.name.toLowerCase() === params.integrationName.toLowerCase());
  const integrationName = capitalizeFirstLetter(params.integrationName);
  // const authType = integration?.authType;
  const authType = 'oauth';

  const dashboardLinks = [
    {
      icon: 'grid',
      title: 'To Integration Data',
      description: 'I want to get data and play around with it in my app ',
      href: `/records/${params.integrationName.toLowerCase()}`,
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

  const syncedData = [
    {
      label: '503 Emails',
      icon: 'envelope',
    },
    {
      label: '503 Contacts',
      icon: 'user',
    },
    {
      label: '506 Calendar Events',
      icon: 'calendar',
    },
    {
      label: '30 Actions',
      icon: 'activity',
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

          <p className="text-xs text-[#A6A6A6] mt-2.5">Choose what you want to do next</p>
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
                    'bg-[#262626] justify-center border border-arkw-border-2/60 rounded-sm py-2.5 text-xs font-medium flex gap-2',
                    isLast ? 'mt-4' : 'my-4',
                  )}
                >
                  <Icon name={icon as IconName} width={14} height={14} />
                  <span>{title}</span>
                </Link>
                {!isLast && <hr className=" border-arkw-border-1/90 mb-4"></hr>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex-1 h-full p-11 relative bg-arkw-bg-2 rounded-r-[4px]">
        <div className="flex mb-11 items-center justify-between">
          <div className="flex gap-3 items-center">
            <div className="w-[50px] h-[50px] rounded-[6px] bg-white/[0.07] flex items-center justify-center">
              <Image src={integration?.logoUrl || ''} alt={integrationName} width={40} height={40} />
            </div>
            <div className="font-medium">
              <h3 className="text-[#E6E6E6]">{integrationName}</h3>
              <p className="text-arkw-el-3">Connected</p>
            </div>
          </div>

          {/* <button className='text-arkw-el-3'>
            <Icon name="documentation" width={14} height={14} />
            </button> */}
        </div>
        <div>
          <h4 className="uppercase text-arkw-el-2 text-xs">You&rsquo;ve just synced</h4>

          <div className="space-y-2 mt-3">
            {syncedData.map(item => {
              return (
                <div className="flex gap-2.5" key={item.label}>
                  <div className="flex items-center text-arkw-el-3 bg-[#5F783E]/10 rounded-[3px] w-10 h-10 justify-center ">
                    <Icon name={item.icon as IconName} width={14} height={14} />
                  </div>
                  <span className="h-10 px-4 flex text-arkw-el-5 text-[13px] font-medium items-center bg-gradient-radial">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuccessIntegrationPage;
