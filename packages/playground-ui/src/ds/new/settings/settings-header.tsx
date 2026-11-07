import { createContext, useContext, useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

const SettingsTitleIdContext = createContext<string | undefined>(undefined);

/** One section of a settings page: a `SettingsTitle` (or `SettingsHeader`) above its `SettingsContainer`. */
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

/** A section title with something beside it. A list's actions go in its card (`SettingsListHeader`), not here. */
export function SettingsHeader({
  action,
  children,
  className,
  ...props
}: ComponentProps<'header'> & { action?: ReactNode }) {
  return (
    <header
      className={cn('flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4', className)}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-1">{children}</div>
      {action != null && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function SettingsTitle({
  accessory,
  info,
  className,
  children,
  ...props
}: Omit<ComponentProps<'h2'>, 'id'> & {
  accessory?: ReactNode;
  /** What the section is for, shown in a tooltip on the title. For sections whose name isn't self-explanatory. */
  info?: ReactNode;
}) {
  const titleId = useContext(SettingsTitleIdContext);
  const infoId = useId();

  return (
    // Inset by 10px, so the title sits a little inside the card's edge below it.
    <div className="flex min-w-0 flex-wrap items-center gap-2 ps-2.5">
      <Txt as="h2" id={titleId} variant="subheading" tone="muted" className={className} {...props}>
        {info == null ? (
          children
        ) : (
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  tabIndex={0}
                  aria-describedby={infoId}
                  className="cursor-help underline decoration-transparent decoration-dotted underline-offset-4 hover:decoration-current focus-visible:decoration-current focus-visible:outline-none"
                />
              }
            >
              {children}
            </TooltipTrigger>
            <TooltipContent id={infoId} keepMounted className="max-w-64">
              {info}
            </TooltipContent>
          </Tooltip>
        )}
      </Txt>
      {accessory}
    </div>
  );
}

export function SettingsDescription({ className, ...props }: ComponentProps<'p'>) {
  return <Txt as="p" variant="caption" tone="muted" className={cn('ps-2.5', className)} {...props} />;
}
