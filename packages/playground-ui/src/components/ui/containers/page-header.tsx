import { cn } from '@/lib/utils';

export function PageHeader({
  children,
  className,
  style,
}: {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <header
      className={cn(`px-4 py-3 col-span-2 border-border1 border-b-sm flex justify-between items-center`, className)}
      style={{ ...style }}
    >
      {children}
    </header>
  );
}
