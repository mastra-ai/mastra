import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip';
import { getItemListColumnTemplate } from './shared';
import type { ItemListColumn } from './types';
import { transitions, focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type ItemListRowButtonProps = React.ComponentPropsWithoutRef<'button'> & {
  item?: any;
  isFeatured?: boolean;
  children?: React.ReactNode;
  onClick?: (itemId: string) => void;
  columns?: ItemListColumn[];
  className?: string;
  disabled?: boolean;
  tooltip?: React.ReactNode;
};

export function ItemListRowButton({
  item,
  isFeatured,
  onClick,
  children,
  columns,
  className,
  disabled,
  tooltip,
  ...props
}: ItemListRowButtonProps) {
  const handleClick = () => {
    onClick?.(item?.id);
  };

  const button = (
    <button
      {...props}
      onClick={handleClick}
      className={cn(
        'grid w-full items-center gap-4 rounded-lg px-4 text-left',
        transitions.colors,
        focusRing.visible,
        {
          'bg-surface4': isFeatured,
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

  if (tooltip == null) return button;

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
