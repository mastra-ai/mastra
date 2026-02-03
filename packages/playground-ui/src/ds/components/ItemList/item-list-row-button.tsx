import { cn } from '@/lib/utils';
import { getColumnTemplate } from './shared';
import { type Column } from './types';
import { transitions } from '@/ds/primitives/transitions';
import { focusRing } from '@/ds/primitives/transitions';

export type ItemListRowButtonProps = {
  entry?: any;
  isSelected?: boolean;
  children?: React.ReactNode;
  onClick?: (itemId: string) => void;
  columns?: Column[];
};

export function ItemListRowButton({ entry, isSelected, onClick, children, columns }: ItemListRowButtonProps) {
  const handleClick = () => {
    onClick?.(entry?.id);
  };

  return (
    <button
      onClick={handleClick}
      className={cn('grid w-full px-4 py-3 gap-6 text-left items-center', transitions.colors, focusRing.visible, {
        // hover effect only not for skeleton and selected
        'hover:bg-surface4': entry && !isSelected,
      })}
      style={{ gridTemplateColumns: getColumnTemplate(columns) }}
      disabled={!entry}
    >
      {children}
    </button>
  );
}
