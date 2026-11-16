import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

/** A choice in the rule builder: an event, a board or a phase. */
export function ChoiceTile({
  selected,
  disabled,
  role = 'radio',
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  /** `checkbox` where several tiles may be picked at once. */
  role?: 'radio' | 'checkbox';
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-50',
        selected
          ? 'border-border-focus bg-fill-hover'
          : 'border-border bg-fill-subtle hover:border-border-hover hover:bg-fill-hover',
      )}
    >
      {children}
    </button>
  );
}
