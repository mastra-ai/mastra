import { cn } from '@/lib/utils';

export function MainHeader({
  children,
  className,
  style,
  width = 'narrow',
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  width?: 'narrow' | 'full';
}) {
  const devStyleRequested = devUIStyleRequested('MainHeader');
  const isNarrow = width === 'narrow';

  if (isNarrow) {
    return (
      <header
        className={cn('overflow-y-scroll bg-surface1 w-full', className)}
        style={{ ...style, ...(devStyleRequested ? { border: '3px dotted orange' } : {}) }}
      >
        <div
          className="text-2xl p-7 pt-10 pb-9 max-w-[60rem] mx-auto font-normal flex group [&>svg]:w-[1.2em] [&>svg]:h-[1.2em] items-center gap-3"
          style={{
            ...style,
            ...(devStyleRequested ? { border: '3px dashed orange' } : {}),
          }}
        >
          {children}
        </div>
      </header>
    );
  }

  return (
    <header
      className={cn(
        'text-2xl pt-9 pb-6 font-normal flex group [&>svg]:w-[1.2em] [&>svg]:h-[1.2em] items-center gap-3 pl-2',
        className,
      )}
      style={{ ...style, ...(devStyleRequested ? { border: '3px dotted orange' } : {}) }}
    >
      {children}
    </header>
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
