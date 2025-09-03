import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useMemo } from 'react';

export function EntryListTextCell({ children, isLoading }: { children: React.ReactNode; isLoading?: boolean }) {
  // Generate random width once per component render
  const randomWidth = useMemo(() => {
    return Math.floor(Math.random() * (90 - 50 + 1)) + 50;
  }, []);

  return (
    <div className="text-icon4 text-[0.875rem] truncate ">
      {isLoading ? (
        <div
          className=" bg-surface4 rounded-md animate-pulse text-transparent h-[1rem] select-none"
          style={{ width: `${randomWidth}%` }}
        ></div>
      ) : (
        children
      )}
    </div>
  );
}

export function EntryListStatusCell({ status }: { status?: 'success' | 'failed' }) {
  return (
    <div className={cn('flex justify-center items-center w-full relative', {})}>
      {status ? (
        <div
          className={cn('w-[0.6rem] h-[0.6rem] rounded-full', {
            'bg-green-600': status === 'success',
            'bg-red-700': status === 'failed',
          })}
        ></div>
      ) : (
        <div className="text-icon2 text-[0.75rem] leading-0">-</div>
      )}
      <VisuallyHidden>Status: {status ? status : 'not provided'}</VisuallyHidden>
    </div>
  );
}
