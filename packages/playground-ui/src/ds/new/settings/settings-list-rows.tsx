import { PlusIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import type { ButtonProps } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

export type SettingsAddRowProps = Omit<ButtonProps, 'variant' | 'size'> & {
  /** The list's other controls, like refresh, at the row's right end. */
  actions?: ReactNode;
};

/** The last row of a list in a `SettingsContainer`: "Add header", "Create join link". Lists put
 * their add action and other list controls here, inside the card, not in the section header. */
export function SettingsAddRow({
  className,
  icon = <PlusIcon />,
  actions,
  type = 'button',
  ...props
}: SettingsAddRowProps) {
  return (
    <div data-slot="settings-add-row" className="flex items-center justify-between gap-2 px-4 py-2">
      {/* Pulled left by its icon-side padding, so the icon lines up with the row labels above. */}
      <Button
        variant="ghost"
        size="sm"
        icon={icon}
        className={cn('-ms-[calc(var(--control-px)-2px)]', className)}
        type={type}
        {...props}
      />
      {actions != null && <div className="flex items-center gap-1">{actions}</div>}
    </div>
  );
}

/** A list's notices and errors, as the first row of its `SettingsContainer`. Hidden while empty. */
export function SettingsNoticeRow({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="settings-notice-row"
      className={cn('flex flex-col gap-2 px-4 py-3 empty:hidden', className)}
      {...props}
    />
  );
}

/** A list's empty state inside its `SettingsContainer`, in place of its rows. */
export function SettingsEmptyRow({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      data-slot="settings-empty-row"
      className={cn('px-4 py-5 text-center text-caption text-muted-foreground', className)}
      {...props}
    />
  );
}
