import type { AvatarSize } from '../Avatar/avatar-size';

export const productAvatarDefaultClasses = 'size-5 [&>svg]:size-icon-xs [&>svg]:p-px';

export const productAvatarIconClasses: Record<AvatarSize, string> = {
  xs: '[&>svg]:size-2',
  inline: '[&>svg]:size-[11px]',
  sm: '[&>svg]:size-icon-sm [&>svg]:p-px',
  md: '[&>svg]:size-icon-md [&>svg]:p-px',
  lg: '[&>svg]:size-icon-lg [&>svg]:p-px',
  control: '[&>svg]:size-icon-md [&>svg]:p-px',
};
