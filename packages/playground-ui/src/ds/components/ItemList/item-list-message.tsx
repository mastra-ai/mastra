import { InfoIcon, TriangleAlertIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ItemListMessageProps = {
  children?: React.ReactNode;
  message?: string;
  className?: string;
  type?: 'info' | 'error';
};

export function ItemListMessage({ children, message, className, type }: ItemListMessageProps) {
  if (!children && !message) {
    return null;
  }

  return (
    <div className={cn('grid border-t border-border1', className)}>
      {message ? (
        <p
          className={cn(
            'grid justify-center justify-items-center gap-2 p-8 text-center text-ui-md text-neutral3',
            '[&>svg]:size-[1.5em] [&>svg]:opacity-75',
            {
              '[&>svg]:text-red-500': type === 'error',
            },
          )}
        >
          {type === 'error' ? <TriangleAlertIcon /> : <InfoIcon />} {message}
        </p>
      ) : (
        children
      )}
    </div>
  );
}
