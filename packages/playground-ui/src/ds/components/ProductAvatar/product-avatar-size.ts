import type { AvatarSize } from '../Avatar/avatar-size';

export const productAvatarDefaultClasses = 'size-5 [&>svg]:size-icon-xs';

export const productAvatarIconClasses: Record<AvatarSize, string> = {
  xs: '[&>svg]:size-2',
  inline: '[&>svg]:size-[11px]',
  sm: '[&>svg]:size-icon-sm',
  md: '[&>svg]:size-icon-md',
  lg: '[&>svg]:size-icon-lg',
  control: '[&>svg]:size-icon-md',
};
