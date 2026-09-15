import type { ComponentPropsWithRef, ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface AppShellFrameProps {
  children: ReactNode;
  className: string;
}

export interface AppShellProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  children: ReactNode;
  mainLabel: string;
  mobileHeader?: ReactNode;
  renderFrame?: (props: AppShellFrameProps) => ReactNode;
  routeHeader?: ReactNode;
}

export function AppShell({
  children,
  className,
  mainLabel,
  mobileHeader,
  ref,
  renderFrame,
  routeHeader,
  ...props
}: AppShellProps) {
  const frame = (
    <div
      data-slot="app-shell-frame"
      className={cn(
        'relative m-1.5 ml-0 grid min-h-0 flex-1 overflow-hidden rounded-studio-frame border border-border1 bg-surface2 shadow-main-frame lg:m-2 lg:ml-0',
        routeHeader ? 'grid-rows-[auto_1fr]' : 'grid-rows-[1fr]',
      )}
    >
      {routeHeader}
      <div
        data-slot="app-shell-main"
        aria-label={mainLabel}
        role="group"
        className="min-h-0 overflow-y-auto outline-none"
      >
        {children}
      </div>
    </div>
  );
  const frameProps: AppShellFrameProps = {
    children: frame,
    className: 'flex min-h-0 flex-1 flex-col',
  };

  return (
    <div ref={ref} data-slot="app-shell" className={cn('flex h-full min-h-0 flex-col', className)} {...props}>
      {mobileHeader}
      {renderFrame ? renderFrame(frameProps) : <div className={frameProps.className}>{frame}</div>}
    </div>
  );
}
