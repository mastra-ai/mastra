import { cn } from '@/lib/utils';

type TextAndIconProps = {
  children: React.ReactNode;
  size?: 'default' | 'asParent';
  className?: string;
};

export function TextAndIcon({ children, size = 'default', className }: TextAndIconProps) {
  return (
    <span
      className={cn(
        'flex items-center gap-[0.25rem] text-icon4',
        '[&>svg]:w-[1.2em] [&>svg]:h-[1.2em] [&>svg]:opacity-50',
        {
          'text-[0.875rem]': size == 'default',
        },
        className,
      )}
    >
      {children}
    </span>
  );
}
