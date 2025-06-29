import { cn } from '@/lib/utils';

export function StackOfElements({
  title,
  children,
  className,
  style,
  variant = 'default',
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'default' | 'mainListCollapsible';
}) {
  return (
    <div
      className={cn(
        {
          'grid grid-cols-[auto_1fr] gap-3': title,
          'items-start': variant === 'mainListCollapsible',
        },
        className,
      )}
      style={{
        ...style,
      }}
    >
      {title && <div className="text-icon3 text-[10px]">{title}</div>}
      <div
        className={cn({
          'flex [&>a]:flex [&>a]:gap-1 [&>a]:text-[10px] [&>a]:items-center [&>a]:leading-0 [&_svg]:w-[12px] [&_svg]:h-[12px] [&_svg]:text-icon3':
            variant === 'mainListCollapsible',
        })}
      >
        {children}
      </div>
    </div>
  );
}
