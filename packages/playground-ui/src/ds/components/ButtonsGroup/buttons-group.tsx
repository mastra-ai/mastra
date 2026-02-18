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
          'gap-[2px] [&>*]:rounded-none [&>*:first-child]:rounded-l-md [&>*:last-child]:rounded-r-md':
            spacing === 'close',
        },
        className,
      )}
    >
      {children}
    </div>
  );
}
