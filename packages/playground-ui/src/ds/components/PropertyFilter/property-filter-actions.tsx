import { EllipsisVerticalIcon, SaveIcon, Trash2Icon, XIcon } from 'lucide-react';
import { Button } from '@/ds/components/Button/Button';
import { DropdownMenu } from '@/ds/components/DropdownMenu/dropdown-menu';

export type PropertyFilterActionsProps = {
  disabled?: boolean;
  /** Neutralize each pill's value (keep pills, clear values). Shown as a button, not a menu item. */
  onClear?: () => void;
  /** Fully remove all active filters. Rendered as "Remove all filters" inside the overflow menu. */
  onRemoveAll?: () => void;
  /** Persist the current filter set (typically to localStorage) for later restoration. */
  onSave?: () => void;
  /** Drop a previously-saved filter set. Wire only when a saved set actually exists. */
  onRemoveSaved?: () => void;
};

/**
 * Shared action bar for filter-driven pages (traces, logs, …). Renders a
 * Clear button and an overflow menu with Remove all / Save / Remove saved actions.
 */
export function PropertyFilterActions({
  disabled,
  onClear,
  onRemoveAll,
  onSave,
  onRemoveSaved,
}: PropertyFilterActionsProps) {
  const hasMenuItems = !!(onRemoveAll || onSave || onRemoveSaved);
  const showClear = !!onClear;
  if (!showClear && !hasMenuItems) return null;

  return (
    <div className="flex items-center gap-2">
      {showClear && (
        <Button disabled={disabled} size="md" onClick={() => onClear!()}>
          <XIcon />
          Clear
        </Button>
      )}

      {hasMenuItems && (
        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <Button disabled={disabled} size="md" aria-label="More filter actions">
              <EllipsisVerticalIcon />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            {onRemoveAll && (
              <DropdownMenu.Item onSelect={() => onRemoveAll()}>
                <XIcon />
                Remove all filters
              </DropdownMenu.Item>
            )}
            {onRemoveAll && (onSave || onRemoveSaved) && <DropdownMenu.Separator />}
            {onSave && (
              <DropdownMenu.Item onSelect={() => onSave()}>
                <SaveIcon />
                Save filters for next time
              </DropdownMenu.Item>
            )}
            {onRemoveSaved && (
              <DropdownMenu.Item onSelect={() => onRemoveSaved()}>
                <Trash2Icon />
                Remove saved filters
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu>
      )}
    </div>
  );
}
