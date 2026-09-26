import { VisuallyHidden } from '@/ds/primitives/visually-hidden';
import { cn } from '@/lib/utils';

export type ItemListItemTextProps = {
  children: React.ReactNode;
  isLoading?: boolean;
};

export function ItemListItemText({ children, isLoading }: ItemListItemTextProps) {
  return (
    <div className="truncate text-body text-muted-foreground">
      {isLoading ? (
        <div className="h-4 animate-pulse rounded-md bg-muted text-transparent select-none"></div>
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
            'bg-success-indicator': status === 'success',
            'bg-destructive-indicator': status === 'failed',
          })}
        ></div>
      ) : (
        <div className="text-caption leading-none text-placeholder">-</div>
      )}
      <VisuallyHidden>Status: {status ? status : 'not provided'}</VisuallyHidden>
    </div>
  );
}
