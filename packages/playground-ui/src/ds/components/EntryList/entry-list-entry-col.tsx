import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

export type EntryListEntryTextColProps = {
  children: React.ReactNode;
  isLoading?: boolean;
};

export function EntryListEntryTextCol({ children, isLoading }: EntryListEntryTextColProps) {
  return (
    <div className="text-neutral4 text-[0.875rem] truncate ">
      {isLoading ? (
        <div className="bg-surface4 rounded-md animate-pulse text-transparent h-[1rem] select-none"></div>
      ) : (
        children
      )}
    </div>
  );
}

export type EntryListEntryStatusColProps = {
  status?: 'success' | 'failed';
};

export function EntryListEntryStatusCol({ status }: EntryListEntryStatusColProps) {
  return (
    <div className={cn('flex justify-center items-center w-full relative')}>
      {status ? (
        <div
          className={cn('w-[0.6rem] h-[0.6rem] rounded-full', {
            'bg-green-600': status === 'success',
            'bg-red-700': status === 'failed',
          })}
        ></div>
      ) : (
        <div className="text-neutral2 text-[0.75rem] leading-none">-</div>
      )}
      <VisuallyHidden>Status: {status ? status : 'not provided'}</VisuallyHidden>
    </div>
  );
}
