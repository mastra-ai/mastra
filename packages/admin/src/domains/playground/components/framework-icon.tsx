import { frameWorkIcon } from '@kpl/core';

import Image from 'next/image';

import { iconArr } from '@/components/ui/svg/iconArr';

import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';
import { IconName } from '@/types/icons';

export const FrameworkIcon = ({ icon, className }: { icon?: frameWorkIcon; className?: string }) => {
  return iconArr?.includes(icon?.icon!) ? (
    <Icon name={icon?.icon as IconName} className={cn('h-[14px] w-[14px]', className)} />
  ) : (
    <Image
      src={icon?.icon ?? ''}
      alt={icon?.alt ?? ''}
      width={14}
      height={14}
      className={cn('h-[14px] w-[14px]', className)}
    />
  );
};
