import { Toolbar } from '@base-ui/react/toolbar';

import { cn } from '@/lib/utils';

export type AvatarRailProps = Omit<Toolbar.Root.Props, 'orientation' | 'aria-label' | 'className'> & {
  'aria-label': string;
  className?: string;
};

export function AvatarRailRoot({ className, ...props }: AvatarRailProps) {
  return (
    <Toolbar.Root
      {...props}
      orientation="vertical"
      data-slot="avatar-rail"
      className={cn('flex shrink-0 flex-col items-center gap-1 overflow-y-auto bg-background px-1.5 py-2', className)}
    />
  );
}
