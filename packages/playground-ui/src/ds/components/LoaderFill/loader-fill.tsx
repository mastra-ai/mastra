import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface LoaderFillProps {
  /** The loader, plus any text beside it. */
  children: ReactNode;
  /** `screen` covers the window, for app boot and sign-in. `parent` (default) covers whatever it is placed in. */
  area?: 'parent' | 'screen';
  className?: string;
}

/**
 * Fills the area it stands for and centers the loader in it, in a block, flex or grid parent. A parent without a
 * height gets a minimum one. Directly inside `PageLayout` it centers on the whole page, where a route's own loader
 * sits, so consecutive loaders don't jump.
 *
 * Reach for `<BrandLoader fill />` or `<Spinner fill />` first: this is for a loader with text beside it.
 */
export function LoaderFill({ children, area = 'parent', className }: LoaderFillProps) {
  return (
    <div
      data-slot="loader-fill"
      className={cn(
        'flex w-full items-center-safe justify-center-safe gap-2',
        area === 'screen' ? 'h-dvh' : 'h-full min-h-32 flex-1',
        className,
      )}
    >
      {children}
    </div>
  );
}
