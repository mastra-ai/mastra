import { cn } from '@/lib/utils';
import { InfoIcon, TriangleAlertIcon } from 'lucide-react';

export type EntryListMessageProps = {
  children?: React.ReactNode;
  message?: string;
  className?: string;
  type?: 'info' | 'error';
};

export function EntryListMessage({ children, message, className, type }: EntryListMessageProps) {
  if (!children && !message) {
    return null;
  }

  return (
    <div className={cn('grid border-t border-border1', className)}>
      {message ? (
        <p
          className={cn(
            'text-neutral3 text-ui-md text-center grid p-8 justify-center justify-items-center gap-2',
            '[&>svg]:w-[1.5em] [&>svg]:h-[1.5em] [&>svg]:opacity-75',
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
