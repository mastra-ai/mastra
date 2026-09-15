import { cn } from '@/lib/utils';

export function sidebarNewNavStackPageClasses(active: boolean, page: 'root' | 'view', className?: string) {
  return cn(
    'col-start-1 row-start-1 min-w-0 transition-[opacity,translate] duration-normal ease-out-custom will-change-[opacity,translate] motion-reduce:transition-none',
    active && 'relative translate-x-0 opacity-100',
    !active && 'pointer-events-none absolute inset-0 opacity-0',
    !active && page === 'root' && '-translate-x-2',
    !active && page === 'view' && 'translate-x-2',
    className,
  );
}
