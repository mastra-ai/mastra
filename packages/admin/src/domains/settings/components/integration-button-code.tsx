'use client';

import { IntegrationButtonCodeSnippet } from '@/domains/integrations/components/integration-button-code-snippet';

export const IntegrationButtonCode = ({ integrationName }: { integrationName: string }) => {
  return (
    <div className="space-y-4 p-8">
      <h4 className="uppercase text-mastra-el-2 text-xs">integration button code</h4>

      <div className="rounded border-[0.5px] border-mastra-border-1">
        <IntegrationButtonCodeSnippet
          name={integrationName}
          className="integrations-setup-code-snippet"
          innerClassName="!w-[26rem]"
        />
      </div>
    </div>
  );
};
