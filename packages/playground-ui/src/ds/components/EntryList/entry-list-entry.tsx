import { cn } from '@/lib/utils';
import { getColumnTemplate } from './shared';
import { type Column } from './types';
import { transitions } from '@/ds/primitives/transitions';
import { focusRing } from '@/ds/primitives/transitions';

export type EntryListEntryProps = {
  entry?: any;
  isSelected?: boolean;
  children?: React.ReactNode;
  onClick?: (itemId: string) => void;
  columns?: Column[];
  isLoading?: boolean;
};

export function EntryListEntry({ entry, isSelected, onClick, children, columns }: EntryListEntryProps) {
  const handleClick = () => {
    onClick?.(entry?.id);
  };

  return (
    <li
      className={cn(
        'border-t text-neutral5 border-border1 last:border-b-0 text-ui-md',
        '[&:last-child>button]:rounded-b-lg',
        transitions.colors,
        {
          'bg-accent1Dark': isSelected,
        },
      )}
    >
      <button
        onClick={handleClick}
        className={cn('grid w-full px-6 gap-6 text-left items-center min-h-12', transitions.colors, focusRing.visible, {
          // hover effect only not for skeleton and selected
          'hover:bg-surface4': entry && !isSelected,
        })}
        style={{ gridTemplateColumns: getColumnTemplate(columns) }}
        disabled={!entry}
      >
        {children}
      </button>
    </li>
  );
}
