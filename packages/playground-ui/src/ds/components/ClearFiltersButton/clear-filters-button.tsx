import { RotateCcwIcon } from 'lucide-react';
import type { MouseEventHandler } from 'react';
import { Button } from '@/ds/components/Button/Button';

export type ClearFiltersButtonProps = {
  onClick: MouseEventHandler<HTMLButtonElement>;
  /** Tooltip and accessible name. */
  label?: string;
  disabled?: boolean;
};

/**
 * Resets every filter in a toolbar: a round icon button at the toolbar's height, named by its
 * tooltip. A single filter's own × removes just that filter, so this one never uses an ×.
 */
export function ClearFiltersButton({ onClick, label = 'Clear filters', disabled }: ClearFiltersButtonProps) {
  return (
    <Button type="button" size="icon-sm" aria-label={label} tooltip={label} onClick={onClick} disabled={disabled}>
      <RotateCcwIcon />
    </Button>
  );
}
