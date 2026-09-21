import { useState } from 'react';

import { Txt } from '../Txt';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type AvatarSize = 'sm' | 'md' | 'lg';

export type AvatarProps = {
  src?: string;
  name: string;
  size?: AvatarSize;
  interactive?: boolean;
  color?: string;
  textColor?: string;
};

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-avatar-sm w-avatar-sm',
  md: 'h-avatar-md w-avatar-md',
  lg: 'h-avatar-lg w-avatar-lg',
};

export const Avatar = ({ src, name, size = 'sm', interactive = false, color, textColor }: AvatarProps) => {
  const [didError, setDidError] = useState(false);
  const initial = name.trim()[0]?.toUpperCase() ?? 'A';
  const showImage = Boolean(src) && !didError;
  const showFallbackTint = !showImage && Boolean(color);

  return (
    <div
      className={cn(
        sizeClasses[size],
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
          variant="body"
          className={cn('text-center', !showFallbackTint && 'text-muted-foreground')}
          style={showFallbackTint && textColor ? { color: textColor } : undefined}
        >
          {initial}
        </Txt>
      )}
    </div>
  );
};
