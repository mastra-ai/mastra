import { TriangleAlertIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type EntryListErrorProps = {
  children?: React.ReactNode;
  message?: string;
};

export function EntryListError({ children, message }: EntryListErrorProps) {
  return (
    <div className="grid border border-border1 border-t-0 bg-surface3 rounded-xl rounded-t-none">
      <p
        className={cn(
          'text-[0.875rem] text-center items-center flex justify-center p-[2.5rem] gap-[1rem] text-icon3',
          '[&>svg]:w-[1.5em] [&>svg]:h-[1.5em] [&>svg]:text-red-500',
        )}
      >
        {message ? (
          <>
            <TriangleAlertIcon /> {message}
          </>
        ) : (
          children
        )}
      </p>
    </div>
  );
}
