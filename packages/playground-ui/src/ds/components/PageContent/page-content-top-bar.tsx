import { cn } from '@/index';

export function PageContentTopBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <aside className={cn('flex items-center py-3 min-h-[2rem] justify-end', className)}>{children}</aside>;
}
