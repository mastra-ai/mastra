import { useContext, useState } from 'react';

import { Txt } from '../Txt/Txt';
import { AvatarSizeContext, avatarSizeClasses } from './avatar-size';
import type { AvatarSize } from './avatar-size';
import { cn } from '@/lib/utils';

export type AvatarProps = {
  src?: string;
  name: string;
  size?: AvatarSize;
  interactive?: boolean;
  color?: string;
  textColor?: string;
};

export function AvatarNamed({ src, name, size, interactive = false, color, textColor }: AvatarProps) {
  const contextSize = useContext(AvatarSizeContext);
  const [failedSrc, setFailedSrc] = useState<string>();
  const resolvedSize = size ?? contextSize ?? 'sm';
  const initial = name.trim()[0]?.toUpperCase() ?? 'A';
  const showImage = Boolean(src) && failedSrc !== src;
  const showFallbackTint = !showImage && Boolean(color);

  return (
    <div
      data-slot="avatar"
      data-size={resolvedSize}
      className={cn(
        avatarSizeClasses[resolvedSize],
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border',
        !showFallbackTint && 'bg-fill',
        interactive && 'cursor-pointer hover:border-border-hover',
      )}
      style={showFallbackTint ? { backgroundColor: color } : undefined}
    >
      {showImage ? (
        <img src={src} alt={name} className="size-full object-cover" onError={() => setFailedSrc(src)} />
      ) : (
        <Txt
          variant={resolvedSize === 'xs' ? 'meta' : 'body'}
          tone={showFallbackTint ? undefined : 'muted'}
          className="text-center"
          style={showFallbackTint && textColor ? { color: textColor } : undefined}
        >
          {initial}
        </Txt>
      )}
    </div>
  );
}
