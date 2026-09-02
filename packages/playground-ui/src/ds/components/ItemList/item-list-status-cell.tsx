import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { cn } from '@/lib/utils';

export type ItemListStatusCellProps = {
  status?: string;
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ItemListStatusCell({ status }: ItemListStatusCellProps) {
  if (!status) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn('relative flex h-full w-10 items-center justify-center bg-transparent')}>
          <div
            className={cn('size-2 rounded-full', {
              'bg-green-9': ['success', 'completed'].includes(status),
              'bg-red-9': ['error', 'failed'].includes(status),
              'bg-orange-9': ['pending', 'running'].includes(status),
            })}
          ></div>
        </div>
      </TooltipTrigger>
      <TooltipContent>{capitalize(status)}</TooltipContent>
    </Tooltip>
  );
}
