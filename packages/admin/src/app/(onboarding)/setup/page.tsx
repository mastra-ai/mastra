import React from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';

import { getIntegrations } from '@/domains/integrations/utils';
import { IntegrationList } from '@/domains/onboarding/components/integration-list';

export const dynamic = 'force-dynamic';

const Index = async () => {
  const integrations = await getIntegrations();
  return (
    <div className="h-[600px] flex w-[800px]">
      <div className="p-11 bg-[#D9D9D9]/[0.02] h-full flex flex-col justify-between max-w-[360px]">
        <div>
          <h3 className="text-[22px] font-medium font-tasa">Choose Integration</h3>

          <p className="mt-3 text-[#A6A6A6] text-[13px]">
            Choose the integration you want to connect to your account. Integrations extend functionality by linking
            external services.
          </p>
        </div>

        {/* <a
          target="_blank"
          href="https://github.com/mastra"
          style={{
            boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.09)',
          }}
          className="mt-3 border border-[#121212]/5 bg-white/[0.08] text-center text-[#E6E6E6] text-[13px] w-full py-2 px-4 rounded-[4px] hover:bg-white/[0.10] transition-colors duration-150"
        >
          I don&rsquo;t have an app
        </a> */}
      </div>
      <div className="flex-1 h-full relative bg-mastra-bg-2 rounded-r-[4px]">
        <ScrollArea className="h-full">
          <IntegrationList integrations={integrations} />
        </ScrollArea>
        {/* TODO: We need to do this differently */}
        {/* <div
          className="h-[308px] w-full absolute bottom-0 left-0 rounded-br-[4px]"
          style={{
            background: 'linear-gradient(180deg, rgba(23, 24, 24, 0.00) 18.74%, #171818 100%)',
          }}
        ></div> */}
      </div>
    </div>
  );
};

export default Index;
