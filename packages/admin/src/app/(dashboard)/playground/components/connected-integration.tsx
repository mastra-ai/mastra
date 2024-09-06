'use client';

import { TabsTrigger } from '@/components/ui/tabs';

import { lowerCaseWord } from '@/lib/string';
import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';
import { IconName } from '@/types/icons';

type ConnectedIntegrationProps = {
  name: string;
  updateCurrentIntegration: (name: string) => void;
  isActive: boolean;
  connections: number;
};
export const ConnectedIntegration = ({
  name,
  connections,

  isActive,
  updateCurrentIntegration,
}: ConnectedIntegrationProps) => {
  if (!name) {
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
        <Icon name={lowercasedName as IconName} className="w-8 h-8" />
        <p className="flex text-left flex-col">
          <span className="capitalize text-sm">{lowercasedName}</span>
          <span className="text-arkw-el-2 text-[0.6rem]">
            {connections} Connection{connections > 1 ? 's' : ''}
          </span>
        </p>
      </button>
    </TabsTrigger>
  );
};
