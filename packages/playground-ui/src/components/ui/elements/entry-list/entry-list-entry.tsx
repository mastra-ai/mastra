import { cn } from '@/lib/utils';
import { getColumnTemplate } from './shared';
import { type Column } from './types';

type EntryListEntryProps = {
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
        'border-t text-[#ccc] border-border1 last:border-b-0 text-[0.875rem]',
        '[&:last-child>button]:rounded-b-lg',
        {
          'bg-surface5': isSelected,
        },
      )}
    >
      <button
        onClick={handleClick}
        className={cn(
          'grid w-full px-[1.5rem] gap-[1.5rem] text-left items-center min-h-[3rem]',
          'focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1px_rgba(24,251,111,.75)]',
          {
            // hover effect only not for skeleton and selected
            'hover:bg-surface4': entry && !isSelected,
          },
        )}
        style={{ gridTemplateColumns: getColumnTemplate(columns) }}
        disabled={!entry}
      >
        {children}
      </button>
    </li>
  );
}
