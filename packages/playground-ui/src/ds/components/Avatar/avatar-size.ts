import { createContext } from 'react';

// `inline` sits next to caption or body text, e.g. in a table row.
export type AvatarSize = 'xs' | 'inline' | 'sm' | 'md' | 'lg' | 'control';

export const avatarSizeClasses: Record<AvatarSize, string> = {
  xs: 'size-icon-xs',
  inline: 'size-icon-md',
  sm: 'size-avatar-sm',
  md: 'size-avatar-md',
  lg: 'size-avatar-lg',
  control: 'size-control-md',
};

export const avatarTextClasses: Record<AvatarSize, string> = {
  xs: 'text-meta',
  inline: 'text-meta',
  sm: 'text-caption',
  md: 'text-body-sm',
  lg: 'text-body',
  control: 'text-body-sm',
};

export const avatarIconClasses: Record<AvatarSize, string> = {
  xs: '[&>svg]:hidden',
  inline: '[&>svg]:size-[11px]',
  sm: '[&>svg]:size-icon-xs',
  md: '[&>svg]:size-icon-sm',
  lg: '[&>svg]:size-icon-sm',
  control: '[&>svg]:size-icon-sm',
};

export const AvatarSizeContext = createContext<AvatarSize | undefined>(undefined);
