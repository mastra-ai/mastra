import { cn } from '@/lib/utils';

export type TextAndIconProps = {
  children: React.ReactNode;
  className?: string;
};

export function TextAndIcon({ children, className }: TextAndIconProps) {
  return (
    <span
      data-slot="text-and-icon"
      className={cn(
        'inline-flex items-center gap-1 text-caption text-muted-foreground',
        '[&>svg]:size-[1.1em] [&>svg]:shrink-0 [&>svg]:opacity-50',
        className,
      )}
    >
      {children}
    </span>
  );
}
