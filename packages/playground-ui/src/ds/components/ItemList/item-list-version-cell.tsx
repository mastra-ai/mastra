import { cn } from '@/lib/utils';
import { ItemListCell } from './item-list-cell';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip';
import { Chip } from '../Chip';
import { BanIcon, ClockIcon } from 'lucide-react';

export type ItemListVersionCellProps = {
  version: string | number;
  date?: Date | string | null;
  isLatest?: boolean;
  isDeleted?: boolean;
};

export function ItemListVersionCell({ version, date, isLatest, isDeleted }: ItemListVersionCellProps) {
  return (
    <ItemListCell className={cn('grid grid-cols-[1fr_auto] pl-1')}>
      <div
        className={cn('grid text-neutral3 gap-1 leading-none', {
          'text-neutral4': isLatest,
        })}
      >
        <strong className="font-normal">v. {version}</strong>
        <em className="text-neutral2 text-ui-sm font-normal">
          {date ? format(new Date(date), 'MMM d, yyyy HH:mm') : null}
        </em>
      </div>
      {(isLatest || isDeleted) && (
        <div className="flex gap-1 items-center">
          {isLatest && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Chip color="blue">
                  <ClockIcon />
                </Chip>
              </TooltipTrigger>
              <TooltipContent>Latest version</TooltipContent>
            </Tooltip>
          )}
          {isDeleted && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Chip color="red">
                  <BanIcon />
                </Chip>
              </TooltipTrigger>
              <TooltipContent>Deleted in this version</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </ItemListCell>
  );
}
