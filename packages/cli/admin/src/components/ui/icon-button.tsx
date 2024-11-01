import React, { ComponentProps } from 'react';

import Image from 'next/image';

import { Icon } from '@/components/icon';

import { cn } from '@/lib/utils';

import { IconName } from '@/types/icons';

import { Button } from './button';

//TODO: use a discriminated union

type SpriteIcon = {
  icon: IconName;
};

type NormalIcon = {
  icon: string;
  asSprite: false;
};

type Icon = SpriteIcon | NormalIcon;
export interface IconButtonProps extends ComponentProps<typeof Button> {
  children?: React.ReactNode;
  icon?: IconName;
  asSprite?: boolean;
  iconClassname?: string;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, asSprite = true, icon, children, iconClassname, ...props }, ref) => {
    return (
      <Button type="button" variant="ghost" className={cn('group', className)} {...props} ref={ref}>
        {asSprite ? (
          icon ? (
            <Icon
              name={icon}
              className={cn(`text-icon group-hover:text-icon h-4 w-4 transition-all ease-in`, iconClassname)}
            />
          ) : null
        ) : (
          <Image
            loading="eager"
            alt={'logo'}
            className={cn('opacity-50 group-hover:opacity-100', iconClassname)}
            src={icon!}
            height={16}
            width={16}
          />
        )}
        {children}
      </Button>
    );
  },
);

IconButton.displayName = IconButton.displayName;
export default IconButton;
