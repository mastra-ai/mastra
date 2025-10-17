import { cn } from '@/lib/utils';

type TextAndIconProps = {
  children: React.ReactNode;
  className?: string;
};

export function TextAndIcon({ children, className }: TextAndIconProps) {
  return (
    <span
      className={cn(
        'flex items-center gap-[0.5em] text-icon4 text-[0.875rem]',
        '[&>svg]:w-[1.1em] [&>svg]:h-[1.1em] [&>svg]:opacity-50 [&_svg]:flex-shrink-0',
        className,
      )}
    >
      {children}
    </span>
  );
}
