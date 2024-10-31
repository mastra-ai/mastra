import { ReactNode } from 'react';

import Link from 'next/link';

import { Icon } from '@/components/icon';

import { cn } from '@/lib/utils';

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
  icon: IconName | ReactNode;
  as?: 'link' | 'div';
  children?: ReactNode;
  classname?: string;
}) {
  if (as === 'link') {
    return (
      <Link
        href={url}
        className={cn(
          'flex cursor-pointer w-full px-2 items-center focus-visible:outline-none transition-colors focus-visible:ring-1 focus-visible:ring-mastra-border-4 gap-3 rounded-xs group text-small hover:bg-mastra-el-6/5',
          isActive ? 'bg-mastra-el-6/5' : '',
          classname,
        )}
      >
        {typeof icon === 'string' ? (
          <Icon
            name={icon as IconName}
            className={cn(
              'w-[0.875rem] h-[0.875rem] text-mastra-el-3 group-hover:text-mastra-el-6',
              isActive ? 'text-mastra-el-6' : '',
            )}
          />
        ) : (
          icon
        )}
        <p
          className={cn(
            'py-[0.38rem] text-mastra-el-6/60 group-hover:text-mastra-el-6 transition-all  capitalize ',
            isActive ? 'text-mastra-el-6' : '',
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
        'flex w-full focus-visible:outline-none transition-colors focus-visible:ring-1 focus-visible:ring-mastra-border-4 cursor-default px-2 items-center justify-between rounded-xs text-small hover:bg-mastra-el-6/5',
        classname,
      )}
    >
      <div className="flex group gap-3 items-center">
        {typeof icon === 'string' ? (
          <Icon
            name={icon as IconName}
            className={cn(
              'w-[0.875rem] h-[0.875rem] text-mastra-el-3 group-hover:text-mastra-el-6',
              isActive ? 'text-mastra-el-6' : '',
            )}
          />
        ) : (
          icon
        )}
        <p
          className={cn(
            'py-[0.38rem] text-mastra-el-6/60 select-none group-hover:text-mastra-el-6 transition-all  capitalize ',
            isActive ? 'text-mastra-el-6' : '',
          )}
        >
          {text}
        </p>
      </div>
      {children}
    </button>
  );
}
