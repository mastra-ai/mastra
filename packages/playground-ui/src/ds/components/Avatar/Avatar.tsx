import { Txt } from '../Txt';

export type AvatarSize = 'sm' | 'md' | 'lg';

export type AvatarProps = {
  src?: string;
  name: string;
  size?: AvatarSize;
};

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-avatar-sm w-avatar-sm',
  md: 'h-avatar-md w-avatar-md',
  lg: 'h-avatar-lg w-avatar-lg',
};

export const Avatar = ({ src, name, size = 'sm' }: AvatarProps) => {
  return (
    <div
      className={`${sizeClasses[size]} border border-border1 bg-surface-3 shrink-0 overflow-hidden rounded-full flex items-center justify-center`}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <Txt variant="ui-md" className="text-center">
          {name[0].toUpperCase()}
        </Txt>
      )}
    </div>
  );
};
