import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

export function EntryListTextCell({ children }: { children: React.ReactNode }) {
  return <div className="text-icon4 text-[0.875rem] truncate ">{children}</div>;
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
        <div className="text-icon2 text-[0.75rem] leading-0">n/a</div>
      )}
      <VisuallyHidden>Status: {status ? status : 'n/a'}</VisuallyHidden>
    </div>
  );
}
