import { AvatarBadge } from './avatar-badge';
import { AvatarElement } from './avatar-element';
import { AvatarFallback } from './avatar-fallback';
import { AvatarGroup } from './avatar-group';
import { AvatarGroupCount } from './avatar-group-count';
import { AvatarImage } from './avatar-image';

export type { AvatarSize } from './avatar-size';
export type { AvatarProps } from './avatar-named';
export type { AvatarRootProps } from './avatar-root';
export type { AvatarImageProps } from './avatar-image';
export type { AvatarFallbackProps } from './avatar-fallback';
export type { AvatarBadgeProps, AvatarBadgeTone } from './avatar-badge';
export type { AvatarGroupProps } from './avatar-group';
export type { AvatarGroupCountProps } from './avatar-group-count';

export const Avatar = Object.assign(AvatarElement, {
  Image: AvatarImage,
  Fallback: AvatarFallback,
  Badge: AvatarBadge,
  Group: AvatarGroup,
  GroupCount: AvatarGroupCount,
});
