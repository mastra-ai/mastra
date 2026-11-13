import { cn } from '@/lib/utils';

// Each page is a Base UI tab panel: it mounts with `data-starting-style`, keeps `data-ending-style`
// until its exit transition ends, then unmounts. An exiting page leaves the flow and clips itself, so
// a long page sliding out beside a short one adds no scroll height. Both pages move together, a full
// width, without fading: the root rests to the left, views to the right. The stack fades them out at the
// sidebar's edges while they move (`sidebar-nav-stack.css`).
export function sidebarNavStackPageClasses(page: 'root' | 'view', className?: string) {
  return cn(
    'relative col-start-1 row-start-1 min-w-0 transition-[translate] duration-180 ease-(--resize-ease) will-change-[translate] motion-reduce:transition-none',
    'data-ending-style:pointer-events-none data-ending-style:absolute data-ending-style:inset-0 data-ending-style:overflow-hidden',
    page === 'root'
      ? 'data-ending-style:-translate-x-full data-starting-style:-translate-x-full'
      : 'data-ending-style:translate-x-full data-starting-style:translate-x-full',
    className,
  );
}
