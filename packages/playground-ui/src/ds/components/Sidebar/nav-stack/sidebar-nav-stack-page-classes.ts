import { cn } from '@/lib/utils';

// Each page is a Base UI tab panel: it mounts with `data-starting-style`, keeps `data-ending-style`
// until its exit transition ends, then unmounts. An exiting page leaves the flow and clips itself, so
// a long page fading out behind a short one adds no scroll height. The root rests to the left, views
// to the right.
export function sidebarNavStackPageClasses(page: 'root' | 'view', className?: string) {
  return cn(
    'relative col-start-1 row-start-1 min-w-0 transition-[opacity,translate] duration-normal ease-out-custom will-change-[opacity,translate] motion-reduce:transition-none',
    'data-ending-style:opacity-0 data-starting-style:opacity-0',
    'data-ending-style:pointer-events-none data-ending-style:absolute data-ending-style:inset-0 data-ending-style:overflow-hidden',
    page === 'root'
      ? 'data-ending-style:-translate-x-2 data-starting-style:-translate-x-2'
      : 'data-ending-style:translate-x-2 data-starting-style:translate-x-2',
    className,
  );
}
