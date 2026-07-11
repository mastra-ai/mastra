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
        '[&_svg]:w-[1.1em] [&_svg]:h-[1.1em] [&_svg]:opacity-50 [&_svg]:shrink-0',
        '[&_img]:w-[1.2em] [&_img]:h-[1.2em] [&_img]:opacity-50 [&_img]:shrink-0',
        className,
      )}
    >
      {children}
    </span>
  );
}
