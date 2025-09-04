import { cn } from '@/lib/utils';
import { Column, getColumnTemplate } from './shared';

export function EntryListItem({
  item,
  selectedItemId,
  onClick,
  children,
  columns,
  isLoading,
}: {
  item: any;
  selectedItemId?: string;
  onClick?: (score: string) => void;
  children?: React.ReactNode;
  columns?: Column[];
  isLoading?: boolean;
}) {
  const isSelected = selectedItemId && selectedItemId === item.id;

  const handleClick = () => {
    return onClick && onClick(item?.id);
  };

  return (
    <li
      className={cn('border-b text-[#ccc] border-border1 last:border-b-0 text-[0.875rem]', {
        'bg-surface5': isSelected,
      })}
    >
      <button
        onClick={handleClick}
        className={cn('grid w-full px-[1.5rem] gap-[2rem] text-left items-center min-h-[3rem]', {
          'hover:bg-surface5': !isLoading,
        })}
        style={{ gridTemplateColumns: getColumnTemplate(columns) }}
        disabled={isLoading}
      >
        {children}
      </button>
    </li>
  );
}
