import { IntegrationCredentialType } from '@mastra/core';
import React from 'react';

import Image from 'next/image';
import Link from 'next/link';

import { Icon } from '@/components/icon';

import { capitalizeFirstLetter, toTitleCase } from '@/lib/string';

import { getCredentialAction } from '@/domains/integrations/actions';
import { IntegrationOAuthSetupForm } from '@/domains/integrations/components/integration-o-auth-setup-form';
import { getIntegrations } from '@/domains/integrations/utils';

const SetupIntegration = async (props: { params: Promise<{ integrationName: string }> }) => {
  const params = await props.params;
  const integrations = await getIntegrations();
  const integration = integrations.find(i => i.name.toLowerCase() === params.integrationName.toLowerCase());
  const integrationName = capitalizeFirstLetter(params.integrationName);
  const authType = integration?.authType;
  const credential = await getCredentialAction({ integrationName: params.integrationName });
  return (
    <div className="h-[600px] flex w-[800px]">
      <div className="p-11 bg-[#D9D9D9]/[0.02] h-full flex flex-col justify-between max-w-[360px]">
        <div>
          <Link className="text-[#5699A8] flex gap-1.5 text-xs" href="/setup">
            <Icon className="-rotate-90" name="arrow-up" width={12} height={12} />
            <span>Back</span>
          </Link>
          <h3 className="text-[22px] mt-2 font-medium font-tasa">{integrationName} set-up</h3>

          <p className="mt-3 text-[#A6A6A6] text-[13px]">
            Supply the necessary information to connect to {capitalizeFirstLetter(params.integrationName)}.
          </p>
        </div>
      </div>
      <div className="flex-1 h-full p-11 relative bg-mastra-bg-2 rounded-r-[4px]">
        <div className="flex mb-11 items-center justify-between">
          <div className="flex gap-3 items-center">
            <div className="w-[50px] h-[50px] rounded-[6px] bg-white/[0.07] flex items-center justify-center">
              <Image src={integration?.logoUrl || ''} alt={integrationName} width={40} height={40} />
            </div>
            <div className="font-medium">
              <h3 className="text-[#E6E6E6]">{toTitleCase(integrationName, '_')}</h3>
              <p className="text-mastra-el-3">
                {authType === IntegrationCredentialType.OAUTH ? 'Set-up' : 'Auth Type Basic'}
              </p>
            </div>
          </div>

          {/* <button className='text-mastra-el-3'>
            <Icon name="documentation" width={14} height={14} />
          </button> */}
        </div>
        <IntegrationOAuthSetupForm
          integrationName={params.integrationName}
          availableScopes={integration?.availableScopes || []}
          credential={credential}
          isUserDefined={integration?.isUserDefined}
        />
      </div>
    </div>
  );
};

export default SetupIntegration;
