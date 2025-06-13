import { cn } from '@/lib/utils';

export function MainLayout({
  children,
  variant = 'default',
  className,
  style,
}: {
  children: React.ReactNode;
  variant?: 'default' | '2x2grid';
  className?: string;
  style?: React.CSSProperties;
}) {
  const devStyleRequested = devUIStyleRequested('MainLayout');

  return (
    <main
      className={cn(
        `grid grid-rows-[auto_1fr] overflow-y-auto h-full px-8`,
        {
          'grid-cols-[1fr_1fr] grid-rows-[auto_1fr] gap-8': variant === '2x2grid',
        },
        className,
      )}
      style={{ ...style, ...(devStyleRequested ? { border: '3px dotted red' } : {}) }}
    >
      {children}
    </main>
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
