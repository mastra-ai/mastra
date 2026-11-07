import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** A list's count or caption on the left and its one action ("Add account", "Invite member") on the right. */
function SettingsListBar({
  tone,
  action,
  className,
  children,
  ...props
}: ComponentProps<'div'> & { tone: 'title' | 'muted'; action?: ReactNode }) {
  return (
    <div className={cn('flex min-h-8 items-center justify-between gap-3', className)} {...props}>
      <div
        className={cn(
          'min-w-0 truncate',
          tone === 'title' ? 'text-label text-foreground' : 'text-body-sm text-muted-foreground',
        )}
      >
        {children}
      </div>
      {action != null && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export type SettingsListHeaderProps = ComponentProps<'div'> & {
  /** The list's action, on the right. Refresh and other list controls can sit beside it. */
  action?: ReactNode;
};

/** The first row of a list's `SettingsContainer`: a count ("2 accounts") and the list's action. */
export function SettingsListHeader(props: SettingsListHeaderProps) {
  return <SettingsListBar data-slot="settings-list-header" tone="title" {...props} />;
}

export type SettingsEmptyRowProps = ComponentProps<'div'> & {
  /** The same action the list's header would hold, so an empty list still offers it. */
  action?: ReactNode;
};

/** An empty list's only row: what's missing on the left ("No join links"), the list's action on the right. */
export function SettingsEmptyRow(props: SettingsEmptyRowProps) {
  return <SettingsListBar data-slot="settings-empty-row" tone="muted" {...props} />;
}

/** A list's notices and errors, as a row of its `SettingsContainer`. Takes no space while it has nothing in it. */
export function SettingsNoticeRow({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="settings-notice-row" className={cn('flex flex-col gap-2', className)} {...props} />;
}

/** The square on the left of a `SettingsItem` holding an icon or logo. Avatars use `Avatar size="md"`, the
 * same size, so every list's text starts at the same place. */
export function SettingsItemIcon({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      data-slot="settings-item-icon"
      aria-hidden
      className={cn(
        'flex size-avatar-md shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&>svg]:size-4',
        className,
      )}
      {...props}
    />
  );
}

export type SettingsItemProps = Omit<ComponentProps<'div'>, 'title'> & {
  /** A `SettingsItemIcon` or an `Avatar size="md"`. */
  media?: ReactNode;
  title: ReactNode;
  /** One line under the title: "GitHub · Connected 3 weeks ago". */
  description?: ReactNode;
  /** The item's status or actions, on the right. */
  children?: ReactNode;
};

/** One thing in a settings list (an account, a member, a session, a source). Goes in a `SettingsContainer`. */
export function SettingsItem({ media, title, description, children, className, ...props }: SettingsItemProps) {
  return (
    <div data-slot="settings-item" className={cn('flex min-w-0 items-center gap-3', className)} {...props}>
      {media}
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <div className="truncate text-label text-foreground">{title}</div>
        {description != null && <div className="truncate text-caption text-muted-foreground">{description}</div>}
      </div>
      {children != null && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}
