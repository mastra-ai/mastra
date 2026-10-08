import { useState } from 'react';

import { Txt } from '../Txt/Txt';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'control';

export type AvatarProps = {
  src?: string;
  name: string;
  size?: AvatarSize;
  interactive?: boolean;
  color?: string;
  textColor?: string;
};

const sizes: Record<AvatarSize, { className: string; initialVariant: 'meta' | 'body' }> = {
  xs: { className: 'size-icon-xs', initialVariant: 'meta' },
  sm: { className: 'h-avatar-sm w-avatar-sm', initialVariant: 'body' },
  md: { className: 'h-avatar-md w-avatar-md', initialVariant: 'body' },
  lg: { className: 'h-avatar-lg w-avatar-lg', initialVariant: 'body' },
  control: { className: 'h-control-md w-control-md', initialVariant: 'body' },
};

export const Avatar = ({ src, name, size = 'sm', interactive = false, color, textColor }: AvatarProps) => {
  const [didError, setDidError] = useState(false);
  const initial = name.trim()[0]?.toUpperCase() ?? 'A';
  const showImage = Boolean(src) && !didError;
  const showFallbackTint = !showImage && Boolean(color);

  return (
    <div
      className={cn(
        sizes[size].className,
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border',
        !showFallbackTint && 'bg-fill',
        controlStateColorTransition,
        interactive && 'cursor-pointer hover:border-border-hover',
      )}
      style={showFallbackTint ? { backgroundColor: color } : undefined}
    >
      {showImage ? (
        <img src={src} alt={name} className="size-full object-cover" onError={() => setDidError(true)} />
      ) : (
        <Txt
          variant={sizes[size].initialVariant}
          tone={showFallbackTint ? undefined : 'muted'}
          className="text-center"
          style={showFallbackTint && textColor ? { color: textColor } : undefined}
        >
          {initial}
        </Txt>
      )}
    </div>
  );
};
