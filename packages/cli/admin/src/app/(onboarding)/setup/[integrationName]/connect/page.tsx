import { IntegrationCredentialType } from '@mastra/core';
import React from 'react';

import Image from 'next/image';
import Link from 'next/link';

import { Icon } from '@/components/icon';
import { ScrollArea } from '@/components/ui/scroll-area';

import { framework } from '@/lib/framework-utils';
import { capitalizeFirstLetter } from '@/lib/string';

import { getIntegrationConnectSnippet } from '@/domains/integrations/actions';
import { ApiKeyConfigProps } from '@/domains/integrations/types';
import { getIntegrations } from '@/domains/integrations/utils';
import { ConnectButton } from '@/domains/onboarding/components/connect-button';
import { ConnectCodeBlock } from '@/domains/onboarding/components/connect-code-block';

const ConnectPage = async (props: { params: Promise<{ integrationName: string }> }) => {
  const params = await props.params;
  const integrations = await getIntegrations();
  const integration = integrations.find(i => i.name.toLowerCase() === params.integrationName.toLowerCase());
  const integrationName = capitalizeFirstLetter(params.integrationName);
  const authType = integration?.authType;
  let apiKeyConfig: ApiKeyConfigProps = {
    type: 'object',
    properties: {
      apiKey: { type: 'string' },
    },
    required: ['apiKey'],
    $schema: '',
    additionalProperties: false,
  };

  if (integration?.authType === IntegrationCredentialType.API_KEY && integration?.config.apiKey) {
    apiKeyConfig = integration?.config.apiKey!;
  }

  const snippet = await getIntegrationConnectSnippet({
    integrationName,
    authType: authType!,
    apiKeyConfig,
  });

  const getOAuthConnectionRoute = async ({ name, connectionId }: { name: string; connectionId: string }) => {
    'use server';
    const router = framework?.createRouter();
    return router?.makeConnectURI({
      clientRedirectPath: `/setup/${name.toLowerCase()}/success?connectionId=${connectionId}`,
      name: name,
      connectionId,
    });
  };

  const backHref = authType === IntegrationCredentialType.OAUTH ? `/setup/${params.integrationName}` : '/setup';

  return (
    <div className="h-[600px] flex w-[920px]">
      <div className="p-11 bg-[#D9D9D9]/[0.02] h-full flex flex-col justify-between w-[360px] flex-shrink-0">
        <div>
          <Link className="text-[#5699A8] flex gap-1.5 text-xs" href={backHref}>
            <Icon className="-rotate-90" name="arrow-up" width={12} height={12} />
            <span>Back</span>
          </Link>
          <h3 className="text-[22px] mt-2 font-medium font-tasa">Connect Users</h3>

          <p className="mt-3 text-[#A6A6A6] text-[13px]">
            This code will add a test button inside your app through which you can connect {integrationName} accounts.
          </p>
        </div>
      </div>
      <div className="flex-1 h-full p-11 bg-mastra-bg-2 rounded-r-[4px]">
        <ScrollArea className="h-full">
          <div className="mb-3">
            <h4 className="text-mastra-el-3 text-xs font-medium">ADD CONNECTION BUTTON TO YOUR APP</h4>
            <p className="text-xs text-[#5C5C5C] mt-1">
              To see real data coming in, this code needs to run on the server
            </p>
          </div>

          <ConnectCodeBlock snippet={snippet} />

          <div className="flex items-center my-7 gap-2">
            <hr className="flex-1 border-mastra-border-2/70" />
            <span className="text-[#5C5C5C] text-xs">OR</span>
            <hr className="flex-1 border-mastra-border-2/70" />
          </div>
          <h3 className="text-mastra-el-3 text-xs font-medium">CONNECT YOUR ACCOUNT VIA KEPLER</h3>
          <p className="text-[#5C5C5C] text-xs mt-1">To test Mastra with your data</p>
          <div className="p-2 mt-3 rounded-[6px] bg-white/[0.07] flex items-center justify-between">
            <div className="flex gap-2 justify-between items-center">
              <Image src={integration?.logoUrl || ''} alt={integrationName} width={38} height={38} />
              <span className="font-medium">{integrationName}</span>
            </div>
            <ConnectButton
              integrationName={integrationName}
              authType={integration?.authType}
              getOAuthConnectionRoute={getOAuthConnectionRoute}
              apiKeyConfig={apiKeyConfig}
            />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default ConnectPage;
