import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

export type ItemListStatusCellProps = {
  status?: 'success' | 'failed';
};

export function ItemListStatusCell({ status }: ItemListStatusCellProps) {
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
        <div className="text-neutral2 text-ui-sm leading-none">-</div>
      )}
      <VisuallyHidden>Status: {status ? status : 'not provided'}</VisuallyHidden>
    </div>
  );
}
