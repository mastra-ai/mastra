import { cn } from '@/lib/utils';

export type TextAndIconProps = {
  children: React.ReactNode;
  className?: string;
};

export function TextAndIcon({ children, className }: TextAndIconProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-caption text-muted-foreground',
        '[&>svg]:size-icon-sm [&>svg]:shrink-0 [&>svg]:opacity-50',
        className,
      )}
    >
      {children}
    </span>
  );
}
