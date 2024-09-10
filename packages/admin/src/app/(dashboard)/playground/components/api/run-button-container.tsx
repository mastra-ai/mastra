'use client';

import { useEffect } from 'react';

import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';
import { useActionPlaygroundContext } from '@/domains/playground/providers/action-playground-provider';

export function RunButtonContainer() {
  const { setButtonContainer, apiRunState } = useActionPlaygroundContext();

  useEffect(() => {
    const el = document.getElementById('button-container') as HTMLDivElement;
    if (!el) return;

    setButtonContainer(el);
  }, []);

  return (
    <div className="p-2 rounded-xl relative run-button-container mx-auto border-arkw-border-2 border-[0.5px] w-fit">
      <span
        className={cn(
          'bg-[#33616B] h-10 relative justify-center flex items-center gap-1 border-[0.5px] border-[#5699A8] rounded text-sm font-medium text-arkw-el-5 w-[10.25rem] py-2 px-3',
          apiRunState === 'loading' ? 'opacity-50' : '',
        )}
        id="button-container"
      >
        {apiRunState === 'loading' ? null : (
          <span className="flex items-center gap-1">
            <Icon name="activity" />
            Run Api
          </span>
        )}
      </span>
    </div>
  );
}
