import { useState } from 'react';

import { Txt } from '../Txt';
import { transitions } from '@/ds/primitives/transitions';
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
        'border border-border1 shrink-0 overflow-hidden rounded-full flex items-center justify-center',
        !showFallbackTint && 'bg-surface3',
        transitions.all,
        interactive && 'cursor-pointer hover:scale-105 hover:border-neutral2 hover:shadow-sm',
      )}
      style={showFallbackTint ? { backgroundColor: color } : undefined}
    >
      {showImage ? (
        <img src={src} alt={name} className="h-full w-full object-cover" onError={() => setDidError(true)} />
      ) : (
        <Txt
          variant="ui-md"
          className={cn('text-center', !showFallbackTint && 'text-neutral4')}
          style={showFallbackTint && textColor ? { color: textColor } : undefined}
        >
          {initial}
        </Txt>
      )}
    </div>
  );
};
