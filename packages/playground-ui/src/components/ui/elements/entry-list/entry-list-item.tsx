import { cn } from '@/lib/utils';
import { Column, getColumnTemplate } from './shared';

export function EntryListItem({
  item,
  selectedItem,
  onClick,
  children,
  columns,
}: {
  item: any;
  selectedItem: any | null;
  onClick?: (score: string) => void;
  children?: React.ReactNode;
  columns?: Column[];
}) {
  const isSelected = selectedItem && selectedItem?.id === item.id;

  console.log('selectedItem', selectedItem, item, isSelected);

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
        className={cn('grid w-full px-[1.5rem] gap-[2rem] text-left items-center min-h-[3rem]', 'hover:bg-surface5')}
        style={{ gridTemplateColumns: getColumnTemplate(columns) }}
      >
        {children}
      </button>
    </li>
  );
}
