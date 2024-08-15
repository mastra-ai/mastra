import Link from 'next/link';

import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';
import { IconName } from '@/types/icons';

export function Tab({
  text,
  url,
  isActive,
  icon,
  isConnected = true,
}: {
  text: string;
  url: string;
  isActive: boolean;
  icon: IconName;
  isConnected?: boolean;
}) {
  return (
    <Link
      href={url}
      className={cn(
        'flex w-full px-2 items-center gap-3 transition-all rounded-xs group text-small hover:bg-light-text/5',
        isActive ? 'bg-light-text/5' : '',
      )}
    >
      <Icon
        name={icon}
        className={cn(
          'w-[0.875rem] h-[0.875rem] text-dim-text group-hover:text-light-text',
          isActive ? 'text-light-text' : '',
        )}
      />
      <p
        className={cn(
          'py-[0.38rem] group-hover:text-light-text transition-all  capitalize ',
          isActive ? 'text-light-text' : '',
        )}
      >
        {text}
      </p>
      {isConnected ? '' : <Icon name="unplug" className="text-dim-text h-3 w-3 ml-auto" />}
    </Link>
  );
}
