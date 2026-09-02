import { VisuallyHidden } from '@/ds/primitives/visually-hidden';
import { cn } from '@/lib/utils';

export type ItemListItemTextProps = {
  children: React.ReactNode;
  isLoading?: boolean;
};

export function ItemListItemText({ children, isLoading }: ItemListItemTextProps) {
  return (
    <div className="text-ui-md truncate text-(--text-primary)">
      {isLoading ? (
        <div className="bg-surface-hover h-4 animate-pulse rounded-md text-transparent select-none"></div>
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
            'bg-success': status === 'success',
            'bg-error': status === 'failed',
          })}
        ></div>
      ) : (
        <div className="text-ui-sm leading-none text-(--text-secondary)">-</div>
      )}
      <VisuallyHidden>Status: {status ? status : 'not provided'}</VisuallyHidden>
    </div>
  );
}
