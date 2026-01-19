import { Txt } from '../Txt';
import { cn } from '@/lib/utils';
import { transitions } from '@/ds/primitives/transitions';

export type AvatarSize = 'sm' | 'md' | 'lg';

export type AvatarProps = {
  src?: string;
  name: string;
  size?: AvatarSize;
  interactive?: boolean;
};

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-avatar-sm w-avatar-sm',
  md: 'h-avatar-md w-avatar-md',
  lg: 'h-avatar-lg w-avatar-lg',
};

export const Avatar = ({ src, name, size = 'sm', interactive = false }: AvatarProps) => {
  return (
    <div
      className={cn(
        sizeClasses[size],
        'border border-border1 bg-surface3 shrink-0 overflow-hidden rounded-full flex items-center justify-center',
        transitions.all,
        interactive && 'cursor-pointer hover:scale-105 hover:border-neutral2 hover:shadow-sm',
      )}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <Txt variant="ui-md" className="text-center text-neutral4">
          {name[0].toUpperCase()}
        </Txt>
      )}
    </div>
  );
};
