import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';

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
        <div className={cn('flex items-center justify-center w-10 relative bg-transparent h-full')}>
          <div
            className={cn('w-[0.5rem] h-[0.5rem] rounded-full', {
              'bg-green-600': ['success', 'completed'].includes(status),
              'bg-red-700': ['error', 'failed'].includes(status),
              'bg-yellow-500': ['pending', 'running'].includes(status),
            })}
          ></div>
        </div>
      </TooltipTrigger>
      <TooltipContent>{capitalize(status)}</TooltipContent>
    </Tooltip>
  );
}
