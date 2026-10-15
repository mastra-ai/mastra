import { createContext } from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'control';

export const avatarSizeClasses: Record<AvatarSize, string> = {
  xs: 'size-icon-xs',
  sm: 'size-avatar-sm',
  md: 'size-avatar-md',
  lg: 'size-avatar-lg',
  control: 'size-control-md',
};

export const avatarTextClasses: Record<AvatarSize, string> = {
  xs: 'text-meta',
  sm: 'text-caption',
  md: 'text-body-sm',
  lg: 'text-body',
  control: 'text-body-sm',
};

export const avatarIconClasses: Record<AvatarSize, string> = {
  xs: '[&>svg]:hidden',
  sm: '[&>svg]:size-icon-xs',
  md: '[&>svg]:size-icon-sm',
  lg: '[&>svg]:size-icon-sm',
  control: '[&>svg]:size-icon-sm',
};

export const AvatarSizeContext = createContext<AvatarSize | undefined>(undefined);
