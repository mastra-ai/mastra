import { cn } from '@/lib/utils';

type PageClassOptions = {
  active: boolean;
  animateIn: boolean;
  page: 'root' | 'view';
  className?: string;
};

// The root page rests to the left and views to the right; an entering page starts from its
// resting side. An exiting page leaves the flow and clips itself, so a long page fading out
// behind a short one never adds scroll height.
export function sidebarNavStackPageClasses({ active, animateIn, page, className }: PageClassOptions) {
  return cn(
    'col-start-1 row-start-1 min-w-0 transition-[opacity,translate] duration-normal ease-out-custom will-change-[opacity,translate] motion-reduce:transition-none',
    active && 'relative translate-x-0 opacity-100',
    active && animateIn && 'starting:opacity-0',
    active && animateIn && (page === 'root' ? 'starting:-translate-x-2' : 'starting:translate-x-2'),
    !active && 'pointer-events-none absolute inset-0 overflow-hidden opacity-0',
    !active && (page === 'root' ? '-translate-x-2' : 'translate-x-2'),
    className,
  );
}
