import { cn } from '@/lib/utils';
import { getItemListColumnTemplate } from './shared';
import { type ItemListColumn } from './types';
import { transitions } from '@/ds/primitives/transitions';
import { focusRing } from '@/ds/primitives/transitions';

export type ItemListRowButtonProps = {
  entry?: any;
  isSelected?: boolean;
  children?: React.ReactNode;
  onClick?: (itemId: string) => void;
  columns?: ItemListColumn[];
  className?: string;
  disabled?: boolean;
};

export function ItemListRowButton({
  entry,
  isSelected,
  onClick,
  children,
  columns,
  className,
  disabled,
}: ItemListRowButtonProps) {
  const handleClick = () => {
    onClick?.(entry?.id);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'grid w-full px-4 py-3 gap-6 text-left items-center',
        transitions.colors,
        focusRing.visible,
        {
          // hover effect only not for skeleton and selected
          'hover:bg-surface4': entry && !isSelected && !disabled,
        },
        className,
      )}
      style={{ gridTemplateColumns: getItemListColumnTemplate(columns) }}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
