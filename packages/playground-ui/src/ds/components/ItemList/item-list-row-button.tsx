import { cn } from '@/lib/utils';
import { getItemListColumnTemplate } from './shared';
import { type ItemListColumn } from './types';
import { transitions } from '@/ds/primitives/transitions';
import { focusRing } from '@/ds/primitives/transitions';

export type ItemListRowButtonProps = {
  item?: any;
  isFeatured?: boolean;
  children?: React.ReactNode;
  onClick?: (itemId: string) => void;
  columns?: ItemListColumn[];
  className?: string;
  disabled?: boolean;
};

export function ItemListRowButton({
  item,
  isFeatured,
  onClick,
  children,
  columns,
  className,
  disabled,
}: ItemListRowButtonProps) {
  const handleClick = () => {
    onClick?.(item?.id);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'grid w-full px-4 gap-4 text-left items-center rounded-lg',
        transitions.colors,
        focusRing.visible,
        {
          'bg-surface4': isFeatured,
          // hover effect only not for skeleton and featured
          'hover:bg-surface4': item && !isFeatured && !disabled,
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
