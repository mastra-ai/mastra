import { cn } from '@/index';

export function PageContentMain({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <main className={cn('bg-surface2 rounded-lg border overflow-y-auto border-border1', className)}>{children}</main>
  );
}
