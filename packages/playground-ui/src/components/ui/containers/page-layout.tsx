import { cn } from '@/lib/utils';

export function PageLayout({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const devStyleRequested = devUIStyleRequested('AppLayout');

  return (
    <div
      className={cn(`h-screen bg-surface1 font-sans grid grid-cols-[auto_1fr] grid-rows-[auto_1fr]`, className)}
      style={{ ...style, ...(devStyleRequested ? { border: '3px dotted green' } : {}) }}
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
