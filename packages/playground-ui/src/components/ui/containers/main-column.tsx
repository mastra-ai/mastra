import { cn } from '@/lib/utils';

export function MainColumn({
  children,
  className,
  style,
  variant,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'default' | 'withHeader';
}) {
  return (
    <div
      className={cn(
        `grid overflow-y-auto h-full p-8 pt-0`,
        {
          'grid-template-rows-[auto_1fr] content-start gap-6': variant === 'withHeader', // always have a header row
        },
        className,
      )}
      style={{
        ...style,
        //  border: '3px dotted blue'
      }}
    >
      {children}
    </div>
  );
}
