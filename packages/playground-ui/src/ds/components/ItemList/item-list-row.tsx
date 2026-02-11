import { cn } from '@/lib/utils';
import { transitions } from '@/ds/primitives/transitions';

export type ItemListRowProps = {
  isSelected?: boolean;
  children?: React.ReactNode;
};

export function ItemListRow({ isSelected, children }: ItemListRowProps) {
  return (
    <li
      className={cn(
        'flex border-t text-neutral5 border-border1 first:border-t-0 text-ui-md',
        '[&:last-child>button]:rounded-b-lg',
        transitions.colors,
        {
          'bg-accent1Dark': isSelected,
        },
      )}
    >
      {children}
    </li>
  );
}
