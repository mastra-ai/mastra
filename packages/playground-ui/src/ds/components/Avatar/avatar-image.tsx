import { Avatar as BaseAvatar } from '@base-ui/react/avatar';

import { cn } from '../../../lib/utils';

export type AvatarImageProps = Omit<BaseAvatar.Image.Props, 'className' | 'alt'> & {
  alt: string;
  className?: string;
};

export function AvatarImage({ className, ...props }: AvatarImageProps) {
  return (
    <BaseAvatar.Image
      {...props}
      data-slot="avatar-image"
      className={cn('size-full rounded-full object-cover', className)}
    />
  );
}
