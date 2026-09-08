import type { ReactNode } from 'react';
import { Txt } from '../Txt';
import { cn } from '@/lib/utils';

export interface SettingsLayoutProps {
  title?: ReactNode;
  action?: ReactNode;
  inset?: boolean;
  children: ReactNode;
}

export function SettingsLayout({ title, action, inset = false, children }: SettingsLayoutProps) {
  if (title === undefined || title === null) {
    return (
      <div
        data-slot="settings-layout-content"
        className="mx-auto w-full max-w-5xl min-w-0 overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8"
      >
        <div className="min-w-0 space-y-14">{children}</div>
      </div>
    );
  }

  return (
    <>
      <div
        data-slot="settings-page-header"
        className="mx-auto w-full max-w-5xl min-w-0 overflow-x-clip px-4 pt-6 pb-0 sm:px-6 sm:pt-12"
      >
        <div className={cn('flex min-w-0 flex-wrap items-center justify-between gap-4', inset && 'pl-4')}>
          <Txt
            as="h1"
            variant="header-md"
            className={cn('min-w-0 truncate', 'font-sans font-medium tracking-normal text-neutral4')}
          >
            {title}
          </Txt>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </div>
      <div
        data-slot="settings-layout-content"
        className="mx-auto w-full max-w-5xl min-w-0 overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8"
      >
        <div className="min-w-0 space-y-8">{children}</div>
      </div>
    </>
  );
}
