import { cn } from '@/index';

export function PageContentMain({
  children,
  className,
  as: Component = 'main',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'main' | 'div';
}) {
  return (
    <Component className={cn('bg-surface2 rounded-lg border overflow-y-auto border-border1', className)}>
      {children}
    </Component>
  );
}
