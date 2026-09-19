import '../../../../../new-theme.css';
import type { ComponentPropsWithRef, ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface AppFrameProps extends ComponentPropsWithRef<'div'> {
  breadcrumb?: ReactNode;
}

export function AppFrame({ children, className, breadcrumb, ...props }: AppFrameProps) {
  return (
    <div
      data-slot="app-frame"
      className={cn(
        'new-theme flex min-h-0 min-w-0 flex-1 flex-col overflow-clip border border-border bg-background lg:m-2 lg:ml-0 lg:rounded-studio-frame lg:shadow-main-frame',
        className,
      )}
      {...props}
    >
      {breadcrumb}
      {children}
    </div>
  );
}
