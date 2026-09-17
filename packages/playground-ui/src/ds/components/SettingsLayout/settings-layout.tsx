import type { ReactNode } from 'react';
import { Txt } from '../Txt';
import { cn } from '@/lib/utils';

export interface SettingsLayoutProps {
  title?: ReactNode;
  titleAccessory?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  inset?: boolean;
  variant?: 'default' | 'header';
  children: ReactNode;
}

export function SettingsLayout({
  title,
  titleAccessory,
  description,
  action,
  inset = false,
  variant,
  children,
}: SettingsLayoutProps) {
  if (title === undefined || title === null) {
    return variant === 'header' ? (
      children
    ) : (
      <div data-slot="settings-layout-content" className="mx-auto w-full max-w-5xl min-w-0 overflow-x-hidden px-4 py-5">
        <div className="min-w-0 space-y-8">{children}</div>
      </div>
    );
  }

  return (
    <>
      <div
        data-slot="settings-page-header"
        className="mx-auto w-full max-w-5xl min-w-0 overflow-x-clip px-4 pt-5 pb-0 sm:pt-6"
      >
        <div className={cn('flex min-w-0 flex-wrap items-start justify-between gap-4', inset && 'pl-4')}>
          <div className="grid min-w-0 gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Txt
                as="h1"
                variant="header-md"
                className={cn('min-w-0 truncate', 'font-sans font-medium tracking-normal text-neutral4')}
              >
                {title}
              </Txt>
              {titleAccessory !== undefined && titleAccessory !== null ? (
                <div className="shrink-0">{titleAccessory}</div>
              ) : null}
            </div>
            {description !== undefined && description !== null ? (
              <Txt as="p" variant="ui-md" className="text-neutral4 m-0 wrap-break-word">
                {description}
              </Txt>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </div>
      {variant === 'header' ? (
        children
      ) : (
        <div
          data-slot="settings-layout-content"
          className="mx-auto w-full max-w-5xl min-w-0 overflow-x-hidden px-4 py-5"
        >
          <div className="min-w-0 space-y-6">{children}</div>
        </div>
      )}
    </>
  );
}
