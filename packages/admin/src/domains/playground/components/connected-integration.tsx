'use client';

import Image from 'next/image';

import { TabsTrigger } from '@/components/ui/tabs';

import { lowerCaseWord } from '@/lib/string';
import { cn } from '@/lib/utils';

type ConnectedIntegrationProps = {
  name: string;
  updateCurrentIntegration: (name: string) => void;
  isActive: boolean;
  icon: string;
  connections: number;
};
export const ConnectedIntegration = ({
  name,
  connections,
  icon,
  isActive,
  updateCurrentIntegration,
}: ConnectedIntegrationProps) => {
  if (!name) {
    return;
  }

  if (name === 'system') {
    return;
  }

  const lowercasedName = lowerCaseWord(name);

  const iconNoBorder = ['x', 'system'];
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
        <span
          className={cn(
            'bg-mastra-bg-4 shrink-0 h-7 w-7 rounded-xs grid place-items-center',
            iconNoBorder.includes(lowercasedName) ? 'bg-transparent' : 'bg-mastra-el-6 ',
          )}
        >
          {icon ? <Image width={20} height={20} src={icon} alt={lowercasedName} /> : null}
        </span>
        <p className="flex text-left flex-col">
          <span className="capitalize text-sm">{lowercasedName}</span>
          <span className="text-mastra-el-2 text-[0.6rem]">
            {connections} Connection{connections > 1 ? 's' : ''}
          </span>
        </p>
      </button>
    </TabsTrigger>
  );
};
