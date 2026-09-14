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
  sidebar?: ReactNode;
}

export function AppShell({
  children,
  className,
  mainLabel,
  mobileHeader,
  ref,
  renderFrame,
  routeHeader,
  sidebar,
  ...props
}: AppShellProps) {
  const frame = (
    <div
      data-slot="app-shell-frame"
      className={cn(
        'relative m-1.5 ml-0 grid min-h-0 flex-1 overflow-hidden rounded-studio-frame border border-border1 bg-surface2 shadow-main-frame [--studio-frame-inset:0.5rem] [--studio-frame-radius:1.5rem] lg:m-2 lg:ml-0',
        routeHeader ? 'grid-rows-[auto_1fr]' : 'grid-rows-[1fr]',
        !sidebar && 'h-[calc(100%-1.5rem)]',
      )}
    >
      {routeHeader}
      <div
        data-slot="app-shell-main"
        aria-label={mainLabel}
        role="group"
        tabIndex={0}
        className="min-h-0 overflow-y-auto"
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
    <div
      ref={ref}
      data-slot="app-shell"
      className={cn('h-full', sidebar && 'lg:grid lg:grid-cols-[auto_1fr] lg:grid-rows-[1fr]', className)}
      {...props}
    >
      {sidebar}
      <div data-slot="app-shell-content" className="flex h-full min-h-0 flex-col">
        {mobileHeader}
        {renderFrame ? renderFrame(frameProps) : <div className={frameProps.className}>{frame}</div>}
      </div>
    </div>
  );
}
