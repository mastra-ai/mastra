import { cn } from '@/lib/utils';

type TextAndIconProps = {
  children: React.ReactNode;
  className?: string;
};

export function TextAndIcon({ children, className }: TextAndIconProps) {
  return (
    <span
      className={cn(
        'flex items-center gap-[0.25rem] text-icon4 text-[0.875rem]',
        '[&>svg]:w-[1.2em] [&>svg]:h-[1.2em] [&>svg]:opacity-50',
        className,
      )}
    >
      {children}
    </span>
  );
}
