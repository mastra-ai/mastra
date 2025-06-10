import { cn } from '@/lib/utils';

export function PageHeader({
  children,
  className,
  style,
  variant = 'playground',
}: {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'playground' | 'cloud';
}) {
  const isPlayground = variant === 'playground';
  const devStyleRequested = devUIStyleRequested('AppLayout');

  return (
    <header
      className={cn(`px-2 py-1 col-span-2 border-border1 border-b-sm flex justify-between items-center`, className)}
      style={{ ...style, ...(devStyleRequested ? { border: '3px dotted pink' } : {}) }}
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
