import { cn } from '@/lib/utils';

export function MainTitle({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <h1
      className={cn(
        'text-2xl font-normal flex group [&>svg]:w-[1.2em] [&>svg]:h-[1.2em] items-center gap-3',
        className,
      )}
      style={{ ...style }}
    >
      {children}
    </h1>
  );
}
