import { cn } from '@/lib/utils';

export function MainContentLayout({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <main className={cn(`grid grid-rows-[auto_1fr] h-full items-start content-start`, className)} style={{ ...style }}>
      {children}
    </main>
  );
}

export function MainContentContent({
  children,
  className,
  isCentered = false,
  isDivided = false,
  hasLeftServiceColumn = false,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  // content is centered in the middle of the page e.g. for empty state
  isCentered?: boolean;
  // content is split into two columns equal width columns
  isDivided?: boolean;
  // used when the left column is a service column (e.g. agent history nav)
  hasLeftServiceColumn?: boolean;
}) {
  return (
    <div
      className={cn(
        `grid overflow-y-auto h-full `,
        `overflow-x-auto min-w-[min-content]`,
        {
          'items-start content-start': !isCentered && !isDivided && !hasLeftServiceColumn,
          'grid place-items-center': isCentered,
          'grid-cols-[1fr_1fr]': isDivided && !hasLeftServiceColumn,
          'grid-cols-[auto_1fr_1fr]': isDivided && hasLeftServiceColumn,
          'grid-cols-[auto_1fr]': !isDivided && hasLeftServiceColumn,
        },
        className,
      )}
      style={{ ...style }}
    >
      {children}
    </div>
  );
}
