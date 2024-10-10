'use client';

import { TabsTrigger } from '@/components/ui/tabs';

import { lowerCaseWord } from '@/lib/string';
import { cn } from '@/lib/utils';

import { IntegrationLogo } from '@/domains/integrations/components/integration-logo';

type ConnectedIntegrationProps = {
  name: string;
  updateCurrentIntegration: (name: string) => void;
  isActive: boolean;
  icon: string;
  connections: number;
  isInstalled: boolean;
};
export const ConnectedIntegration = ({
  name,
  connections,
  icon,
  isActive,
  isInstalled,
  updateCurrentIntegration,
}: ConnectedIntegrationProps) => {
  if (!name) {
    return;
  }

  if (name === 'system') {
    return;
  }

  const lowercasedName = lowerCaseWord(name);

  return (
    <TabsTrigger asChild value={lowercasedName}>
      <button
        key={name}
        onClick={() => updateCurrentIntegration(name)}
        className={cn(
          'rounded-[0.625rem] h-14 w-full px-2 transition-all flex gap-4 items-center hover:shadow-sm',
          isActive ? 'bg-[rgba(255,255,255,0.03)]' : '',
        )}
      >
        <IntegrationLogo name={name} logoUrl={icon} />
        <p className="flex text-left flex-col">
          <span className="capitalize text-sm">{lowercasedName}</span>
          <span className="text-mastra-el-2 text-[0.6rem]">
            {connections} Connection{connections > 1 ? 's' : ''}
            {isInstalled ? '' : ' . Not Installed'}
          </span>
        </p>
      </button>
    </TabsTrigger>
  );
};
