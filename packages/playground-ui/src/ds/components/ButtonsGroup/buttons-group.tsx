import { cn } from '@/lib/utils';

export type ButtonsGroupProps = {
  children: React.ReactNode;
  className?: string;
  spacing?: 'default' | 'close';
};

export function ButtonsGroup({ children, className, spacing = 'default' }: ButtonsGroupProps) {
  return (
    <div
      className={cn(
        `flex gap-2 items-center`,
        {
          'gap-0 [&>*:not(:last-child)]:rounded-r-none [&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:-ml-px':
            spacing === 'close',
        },
        className,
      )}
    >
      {children}
    </div>
  );
}
