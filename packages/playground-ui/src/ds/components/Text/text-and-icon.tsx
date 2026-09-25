import { cn } from '@/lib/utils';

export type TextAndIconProps = {
  children: React.ReactNode;
  className?: string;
};

export function TextAndIcon({ children, className }: TextAndIconProps) {
  return (
    <span
      className={cn(
        'flex items-center gap-1',
        '[&_svg]:size-icon-sm [&_svg]:shrink-0 [&_svg]:opacity-50',
        '[&_img]:size-icon-sm [&_img]:shrink-0 [&_img]:opacity-50',
        className,
      )}
    >
      {children}
    </span>
  );
}
