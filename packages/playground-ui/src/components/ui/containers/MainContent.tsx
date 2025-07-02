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
  const devStyleRequested = devUIStyleRequested('MainContentLayout');

  return (
    <main
      className={cn(`grid grid-rows-[auto_1fr] h-full items-start content-start`, className)}
      style={{ ...style, ...(devStyleRequested ? { border: '3px dotted red' } : {}) }}
    >
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
  const devStyleRequested = devUIStyleRequested('MainContentContent');

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
      style={{ ...style, ...(devStyleRequested ? { border: '3px dotted orange' } : {}) }}
    >
      {children}
    </div>
  );
}

function devUIStyleRequested(name: string) {
  try {
    const raw = localStorage.getItem('add-dev-style-to-components');
    if (!raw) return false;

    const components = raw
      .split(',')
      .map(c => c.trim())
      .filter(Boolean); // remove empty strings

    return components.includes(name);
  } catch (error) {
    console.error('Error reading or parsing localStorage:', error);
    return false;
  }
}
