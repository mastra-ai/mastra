import { cn } from '@/lib/utils';

export function MainLayout({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <main
      className={cn(
        'bg-surface2 rounded-[0.375rem] border border-border1 overflow-y-auto grid grid-rows-[auto_1fr]',
        // hack to cover the PageLayout border instead of aligning with it
        'translate-x-[1px] translate-y-[1px]',
        className,
      )}
      style={{
        ...style,
      }}
    >
      {children}
    </main>
  );
}
