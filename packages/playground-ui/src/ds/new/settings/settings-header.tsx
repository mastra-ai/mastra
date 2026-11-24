import { createContext, useContext, useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { IconCircleInfo } from '@/ds/icons/central/IconCircleInfo';
import { Icon } from '@/ds/icons/Icon';
import { controlStateColorTransition, focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

// On a settings page (`PageLayout variant="settings"`), section titles and descriptions sit 10px inside the card's edge, in line with
// the inset page title. Anywhere else (forms, other pages) they line up with the page's left edge and field labels.
// The inset is a custom property, so a caller's `ps-*` class still wins. Written out in full so Tailwind finds it.
const settingsInset =
  '[--settings-inset:0px] in-data-[slot=settings-layout]:[--settings-inset:--spacing(2.5)] ps-(--settings-inset)';

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
  /** What the section is for: a muted info icon after the title, and a tooltip on hovering or focusing either. For sections whose name isn't self-explanatory. */
  info?: ReactNode;
}) {
  const titleId = useContext(SettingsTitleIdContext);

  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-2', settingsInset)}>
      <Txt as="h2" id={titleId} variant="subheading" tone="ink" className={className} {...props}>
        {info == null ? children : <SettingsTitleInfo info={info}>{children}</SettingsTitleInfo>}
      </Txt>
      {accessory}
    </div>
  );
}

/**
 * The title and a muted info icon after it, as one tooltip trigger described by `info`. Hovering or focusing
 * anywhere on it lifts the icon and opens the tooltip quickly: the reader is reaching for the explanation.
 */
function SettingsTitleInfo({ info, children }: { info: ReactNode; children: ReactNode }) {
  const infoId = useId();

  return (
    <Tooltip>
      <TooltipTrigger
        delay={50}
        render={
          <span
            tabIndex={0}
            aria-describedby={infoId}
            className={cn(
              'group/title-info -mx-1 inline-flex cursor-default items-center gap-1 rounded-sm px-1',
              focusRing,
            )}
          />
        }
      >
        {children}
        <Icon
          size="xs"
          aria-hidden
          // Half a pixel down centers the circle optically against the title's text.
          className={cn(
            'translate-y-[0.5px] text-subtle-foreground group-hover/title-info:text-muted-foreground group-focus-visible/title-info:text-muted-foreground',
            controlStateColorTransition,
          )}
        >
          <IconCircleInfo />
        </Icon>
      </TooltipTrigger>
      <TooltipContent id={infoId} keepMounted className="max-w-64">
        {info}
      </TooltipContent>
    </Tooltip>
  );
}

export function SettingsDescription({ className, ...props }: ComponentProps<'p'>) {
  return <Txt as="p" variant="caption" tone="muted" className={cn(settingsInset, className)} {...props} />;
}
