import { VisuallyHidden } from '@/ds/primitives/visually-hidden';
import { cn } from '@/lib/utils';

export type ItemListItemTextProps = {
  children: React.ReactNode;
  isLoading?: boolean;
};

export function ItemListItemText({ children, isLoading }: ItemListItemTextProps) {
  return (
    <div className="text-ui-md text-neutral4 truncate">
      {isLoading ? (
        <div className="bg-surface4 h-4 animate-pulse rounded-md text-transparent select-none"></div>
      ) : (
        children
      )}
    </div>
  );
}

export type ItemListItemStatusProps = {
  status?: 'success' | 'failed';
};

export function ItemListItemStatus({ status }: ItemListItemStatusProps) {
  return (
    <div className={cn('relative flex w-full items-center justify-center')}>
      {status ? (
        <div
          className={cn('size-[0.6rem] rounded-full', {
            'bg-green-600': status === 'success',
            'bg-red-700': status === 'failed',
          })}
        ></div>
      ) : (
        <div className="text-ui-sm text-neutral2 leading-none">-</div>
      )}
      <VisuallyHidden>Status: {status ? status : 'not provided'}</VisuallyHidden>
    </div>
  );
}
