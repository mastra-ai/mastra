import { cn } from '@/lib/utils';

export function MainHeader({
  children,
  className,
  style,
  width = 'narrow',
  variant = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  width?: 'narrow' | 'full';
  variant?: 'default' | 'forList' | 'oneColForAgent' | 'twoColsForAgent';
}) {
  const isNarrow = width === 'narrow';
  const forListTypePage = variant === 'forList';

  if (forListTypePage) {
    return (
      <header className={cn('overflow-y-scroll bg-surface1 w-full', className)} style={style}>
        <div
          className="text-2xl p-7 pt-10 pb-9 max-w-[60rem] mx-auto font-normal flex group [&>svg]:w-[1.2em] [&>svg]:h-[1.2em] items-center gap-3"
          style={style}
        >
          {children}
        </div>
      </header>
    );
  }

  return (
    <header
      className={cn(
        //'text-2xl pt-9 pb-6 font-normal flex group [&>svg]:w-[1.2em] [&>svg]:h-[1.2em] items-center gap-3 pl-2',
        {
          'text-2xl pt-9 pb-6 font-normal flex group [&>svg]:w-[1.2em] [&>svg]:h-[1.2em] items-center gap-3 pl-2':
            variant === 'default',
          'grid gap-4 pt-6 ': variant === 'oneColForAgent',
          'grid gap-4 pt-6 col-span-full': variant === 'twoColsForAgent',
        },
        className,
      )}
      style={style}
    >
      {children}
    </header>
  );
}
