import { cn } from '@/lib/utils';

export function MainContent({
  children,
  className,
  isCentered = false,
  isDivided = false,
  hasLeftServiceColumn = false,
  style,
  width = 'narrow',
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
  width?: 'narrow' | 'full';
}) {
  const isNarrow = width === 'narrow';
  const devStyleRequested = devUIStyleRequested('MainContent');

  if (isNarrow) {
    return (
      <div
        className={cn(`grid overflow-y-scroll h-full pb-[5rem]`, className)}
        style={{ ...style, ...(devStyleRequested ? { border: '3px dotted orange' } : {}) }}
      >
        <div
          className="h-auto w-full max-w-[60rem] mx-auto px-7"
          style={{
            ...style,
            ...(devStyleRequested ? { border: '3px dashed orange' } : {}),
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        `grid overflow-y-auto h-full`,
        `overflow-x-auto min-w-[min-content]`,
        {
          'items-start content-start': !isCentered && !isDivided && !hasLeftServiceColumn,
          'grid place-items-center': isCentered,
          'grid-cols-[1fr_1fr]': isDivided && !hasLeftServiceColumn,
          'grid-cols-[auto_1fr_1fr]': isDivided && hasLeftServiceColumn,
          'grid-cols-[auto_1fr]': !isDivided && hasLeftServiceColumn,
          'h-auto w-full max-w-[60rem] mx-auto px-7 pb-[5rem]': width === 'narrow',
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
