import { ReactNode } from 'react';

import Link from 'next/link';

import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';
import { IconName } from '@/types/icons';

export function Tab({
  text,
  url,
  isActive,
  icon,

  as = 'link',
  children,
  classname,
}: {
  text: string;
  url: string;
  isActive: boolean;
  icon: IconName;

  as?: 'link' | 'div';
  children?: ReactNode;
  classname?: string;
}) {
  if (as === 'link') {
    return (
      <Link
        href={url}
        className={cn(
          'flex w-full px-2 items-center gap-3 transition-all rounded-xs group text-small hover:bg-arkw-el-6/5',
          isActive ? 'bg-arkw-el-6/5' : '',
          classname,
        )}
      >
        <Icon
          name={icon}
          className={cn(
            'w-[0.875rem] h-[0.875rem] text-arkw-el-3 group-hover:text-arkw-el-6',
            isActive ? 'text-arkw-el-6' : '',
          )}
        />
        <p
          className={cn(
            'py-[0.38rem] text-arkw-el-6/60 group-hover:text-arkw-el-6 transition-all  capitalize ',
            isActive ? 'text-arkw-el-6' : '',
          )}
        >
          {text}
        </p>
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'flex w-full cursor-pointer px-2 items-center justify-between transition-all rounded-xs text-small hover:bg-arkw-el-6/5',
        classname,
      )}
    >
      <div className="flex group gap-3 items-center">
        <Icon
          name={icon}
          className={cn(
            'w-[0.875rem] h-[0.875rem] text-arkw-el-3 group-hover:text-arkw-el-6',
            isActive ? 'text-arkw-el-6' : '',
          )}
        />
        <p
          className={cn(
            'py-[0.38rem] text-arkw-el-6/60 select-none group-hover:text-arkw-el-6 transition-all  capitalize ',
            isActive ? 'text-arkw-el-6' : '',
          )}
        >
          {text}
        </p>
      </div>
      {children}
    </button>
  );
}
