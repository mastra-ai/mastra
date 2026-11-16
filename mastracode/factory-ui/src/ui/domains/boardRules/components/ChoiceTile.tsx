import { RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useId } from 'react';
import type { ReactNode } from 'react';

const TILE = 'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors';
const SELECTED = 'border-border-focus bg-fill-hover';
const UNSELECTED = 'border-border bg-fill-subtle hover:border-border-hover hover:bg-fill-hover';

/** A tile in the rule builder that may be picked with others, such as an event. */
export function ChoiceTile({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(TILE, 'disabled:opacity-50', selected ? SELECTED : UNSELECTED)}
    >
      {children}
    </button>
  );
}

/**
 * One choice of a `RadioGroup` in the rule builder, such as a board or a phase. The radio stays for keyboard and screen
 * readers (one tab stop, arrow keys move the choice) but is visually hidden: the tile marks the choice and shows its
 * focus ring. `onClick` runs only on a pointer pick, not when the arrow keys move the choice.
 */
export function RadioTile({
  value,
  selected,
  disabled,
  onClick,
  children,
}: {
  value: string;
  selected: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  const labelId = useId();
  return (
    <label
      onClick={onClick}
      className={cn(
        TILE,
        'has-[[role=radio]:focus-visible]:outline-border-focus has-[[role=radio]:focus-visible]:outline-1 has-[[role=radio]:focus-visible]:outline-solid',
        selected ? SELECTED : UNSELECTED,
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      )}
    >
      <RadioGroupItem value={value} disabled={disabled} aria-labelledby={labelId} className="sr-only" />
      <span id={labelId} className="flex min-w-0 items-start gap-3">
        {children}
      </span>
    </label>
  );
}
