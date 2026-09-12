import { createContext, useContext, useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

const SettingsTitleIdContext = createContext<string | undefined>(undefined);

export function SettingsGroup({ className, ...props }: ComponentProps<'section'>) {
  const titleId = useId();

  return (
    <SettingsTitleIdContext.Provider value={titleId}>
      <section
        aria-labelledby={titleId}
        className={cn('flex min-w-0 scroll-mt-4 flex-col gap-2', className)}
        {...props}
      />
    </SettingsTitleIdContext.Provider>
  );
}

export function SettingsHeader({
  action,
  children,
  className,
  ...props
}: ComponentProps<'header'> & { action?: ReactNode }) {
  return (
    <header
      className={cn('flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4', className)}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-1">{children}</div>
      {action != null && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function SettingsTitle({
  accessory,
  className,
  ...props
}: Omit<ComponentProps<'h2'>, 'id'> & { accessory?: ReactNode }) {
  const titleId = useContext(SettingsTitleIdContext);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Txt
        as="h2"
        id={titleId}
        variant="ui-sm"
        className={cn('text-icon6 leading-ui-md font-semibold', className)}
        {...props}
      />
      {accessory}
    </div>
  );
}

export function SettingsDescription({ className, ...props }: ComponentProps<'p'>) {
  return <Txt as="p" variant="ui-sm" className={cn('text-icon3', className)} {...props} />;
}
