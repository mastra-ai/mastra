import { cn } from '@/lib/utils';
import { InfoIcon, TriangleAlertIcon } from 'lucide-react';

type EntryListMessageProps = {
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
            'text-icon3 text-[0.875rem] text-center grid p-[2rem] justify-center justify-items-center gap-[.5rem]',
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
