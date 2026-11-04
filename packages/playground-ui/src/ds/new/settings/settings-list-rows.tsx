import { PlusIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Button } from '@/ds/components/Button';
import type { ButtonProps } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

export type SettingsAddRowProps = Omit<ButtonProps, 'variant' | 'size'>;

/** The last row of a list in a `SettingsContainer`: "Add header", "Create join link". Lists put
 * their add action here, inside the card, not in the section header. */
export function SettingsAddRow({ className, icon = <PlusIcon />, ...props }: SettingsAddRowProps) {
  return (
    <div data-slot="settings-add-row" className="px-4 py-2">
      {/* Pulled left by its icon-side padding, so the icon lines up with the row labels above. */}
      <Button
        variant="ghost"
        size="sm"
        icon={icon}
        className={cn('-ms-[calc(var(--control-px)-2px)]', className)}
        {...props}
      />
    </div>
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
